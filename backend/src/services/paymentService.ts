/**
 * paymentService.ts — CORE: Payment orchestration
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { rateService } from './rateService';
import { transactionStore } from './transactionStore';
import { worldChainListener } from './worldChainListener';
import { offrampService } from './offrampService';
import { logger, maskPhoneNumber, maskWalletAddress, formatTransactionType, formatAmount } from '../utils/logger';
import type {
  IPaymentService,
  InitiatePaymentParams,
  InitiatePaymentResult,
  ConfirmPaymentParams,
  ConfirmPaymentResult,
  TransactionStatusResult,
  Transaction,
  TransactionStep,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMpesaFees(amount: number): number {
  if (amount <= 100) return 0;
  if (amount <= 500) return 7;
  if (amount <= 1000) return 13;
  if (amount <= 1500) return 23;
  if (amount <= 2500) return 33;
  if (amount <= 3500) return 53;
  if (amount <= 5000) return 57;
  if (amount <= 7500) return 78;
  if (amount <= 10000) return 90;
  if (amount <= 15000) return 100;
  if (amount <= 20000) return 105;
  return 108;
}

function calculateWldAmount(
  kesAmount: number,
  wldPriceKes: number,
  feePercent: number
): { wldAmount: string; feeWld: string; feeKes: number } {
  const ourFee = (kesAmount * feePercent) / 100;
  const safaricomFee = getMpesaFees(kesAmount);
  const feeKes = parseFloat((ourFee + safaricomFee).toFixed(2));
  const totalKes = kesAmount + feeKes;
  const wldAmount = parseFloat((totalKes / wldPriceKes).toFixed(6)).toString();
  const feeWld = parseFloat((feeKes / wldPriceKes).toFixed(6)).toString();
  return { wldAmount, feeWld, feeKes };
}

function makeStep(step: string, done = false): TransactionStep {
  return { step, timestamp: new Date().toISOString(), done };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Simulated implementation ─────────────────────────────────────────────────

class SimulatedPaymentService implements IPaymentService {
  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { transactionType, kesAmount, tillNumber, phoneNumber, accountNumber, walletAddress } = params;

    // Validate inputs
    if (kesAmount < config.MIN_KES_AMOUNT || kesAmount > config.MAX_KES_AMOUNT) {
      throw new Error(`Amount must be between KES ${config.MIN_KES_AMOUNT} and KES ${config.MAX_KES_AMOUNT}`);
    }

    if (transactionType === 'paybill') {
      if (!tillNumber || !/^\d{5,7}$/.test(tillNumber)) throw new Error('Invalid Paybill number');
      if (!accountNumber) throw new Error('Account number is required');
    } else if (transactionType === 'send' || transactionType === 'pochi') {
      if (!phoneNumber || !/^(\+254|0)[17]\d{8}$/.test(phoneNumber)) throw new Error('Invalid M-Pesa phone number');
    } else {
      if (!tillNumber || !/^\d{5,6}$/.test(tillNumber)) throw new Error('Invalid Till number — must be 5 or 6 digits');
    }

    // Fetch rate
    const rate = await rateService.getWldKesRate();
    const { wldAmount, feeWld, feeKes } = calculateWldAmount(
      kesAmount,
      rate.wldPriceKes,
      config.FEE_PERCENT
    );

    // Create transaction
    const tx: Transaction = {
      // @ts-ignore - Some stores might use 'id'
      id: `TXN-${Date.now()}-${uuidv4().slice(0, 4).toUpperCase()}`,
      status: 'INITIATED',
      transactionType,
      kesAmount,
      tillNumber,
      phoneNumber,
      accountNumber,
      walletAddress,
      wldAmount,
      feeWld,
      feeKes,
      wldRate: rate.wldPriceKes.toString(),
      payToAddress: config.BACKEND_WALLET_ADDRESS,
      createdAt: new Date().toISOString(),
    };

    await transactionStore.save(tx);
    
    // Log payment initiation with masked sensitive data
    const recipient = transactionType === 'send' || transactionType === 'pochi'
      ? maskPhoneNumber(phoneNumber)
      : transactionType === 'paybill'
      ? `Paybill ${tillNumber} (Acct: ${accountNumber?.slice(0, 3)}...)`
      : `Till ${tillNumber}`;
    
    logger.paymentInitiated(tx.id, transactionType, kesAmount, recipient);
    logger.info('PAYMENT', `Rate: 1 WLD = ${formatAmount(rate.wldPriceKes)} | Fee: ${formatAmount(feeKes)}`, tx.id, {
      wldAmount: `${wldAmount} WLD`,
      payToAddress: maskWalletAddress(config.BACKEND_WALLET_ADDRESS),
    });

    return {
      transactionId: tx.id,
      wldAmount,
      feeWld,
      feeKes,
      rate: rate.wldPriceKes.toString(),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      payToAddress: config.BACKEND_WALLET_ADDRESS,
    };
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
    const { transactionId, txHash, miniKitPayload } = params;
    const tx = await transactionStore.get(transactionId);

    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);
    if (tx.status !== 'INITIATED') {
      throw new Error(`Transaction ${transactionId} is in state ${tx.status} — cannot confirm`);
    }

    await transactionStore.update(transactionId, {
      status: 'PENDING_CONFIRMATION',
      txHash,
      miniKitPayload,
      confirmedAt: new Date().toISOString(),
    });

    logger.info('PAYMENT', `Payment confirmed on-chain`, transactionId, {
      txHash: txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}` : 'N/A',
    });
    
    logger.pipelineStep(transactionId, 1, 4, '✓ WLD payment confirmed on World Chain');
    void this.processPaymentPipeline(transactionId);

    return {
      transactionId,
      status: 'PENDING_CONFIRMATION',
      estimatedSettlementMinutes: 3,
    };
  }

  async processPaymentPipeline(transactionId: string): Promise<void> {
    const tx = await transactionStore.get(transactionId);
    if (!tx) return;

    const log = (step: number, msg: string) => logger.pipelineStep(transactionId, step, 4, msg);

    try {
      log(1, 'Waiting for WLD confirmation…');
      await sleep(config.SIM_BLOCK_CONFIRM_MS);
      await transactionStore.update(transactionId, { status: 'CONFIRMED' });
      log(1, '✓ WLD received');

      // Step 2: DEX Swap (WLD → USDC) for rebalancing
      log(2, 'Rebalancing liquidity (WLD → USDC)...');
      await sleep(config.SIM_OFFRAMP_MS / 2); // Simulate swap time
      await transactionStore.update(transactionId, { status: 'SWAP_COMPLETED' });
      log(2, '✓ DEX swap completed');

      // Step 3: Off-ramp via Bitnob
      log(3, `Off-ramp: ${formatTransactionType(tx.transactionType)} via Bitnob...`);
      await transactionStore.update(transactionId, { status: 'OFFRAMP_INITIATED' });
      await sleep(config.SIM_OFFRAMP_MS / 2);
      log(3, '✓ Bitnob payout queued');

      const destination = tx.transactionType === 'send' || tx.transactionType === 'pochi'
        ? maskPhoneNumber(tx.phoneNumber)
        : tx.transactionType === 'paybill'
        ? `Paybill ${tx.tillNumber}`
        : `Till ${tx.tillNumber}`;

      // Step 4: Final disbursement
      log(4, `Sending ${formatAmount(tx.kesAmount)} to ${destination}…`);
      await transactionStore.update(transactionId, { status: 'MPESA_SENT' });
      await sleep(config.SIM_MPESA_MS);

      const receiptNumber = `RGX${Date.now().toString().slice(-8)}`;

      await transactionStore.update(transactionId, {
        status: 'SETTLED',
        mpesaReceiptNumber: receiptNumber,
        settledAt: new Date().toISOString(),
      });

      log(4, `✓ SETTLED — Receipt: ${receiptNumber}`);
      logger.info('PAYMENT', `Transaction completed successfully`, transactionId, {
        receiptNumber,
        kesAmount: formatAmount(tx.kesAmount),
        destination,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown pipeline error';
      logger.error('PAYMENT', `Pipeline failed: ${msg}`, transactionId, err);
      await this.failTransaction(transactionId, msg);
    }
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatusResult> {
    const tx = await transactionStore.get(transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);

    return {
      transactionId: tx.id || (tx as any).transactionId,
      status: tx.status,
      transactionType: tx.transactionType,
      kesAmount: tx.kesAmount,
      tillNumber: tx.tillNumber ?? undefined,
      phoneNumber: tx.phoneNumber ?? undefined,
      accountNumber: tx.accountNumber ?? undefined,
      mpesaReceiptNumber: tx.mpesaReceiptNumber ?? undefined,
      settledAt: tx.settledAt ?? undefined,
      failureReason: tx.failureReason ?? undefined,
      steps: this.buildSteps(tx),
    };
  }

  private buildSteps(tx: Transaction): TransactionStep[] {
    const statusOrder: Transaction['status'][] = ['CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'];
    const stepKeys = ['WLD_RECEIVED', 'DEX_SWAP', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'];
    const currentIdx = statusOrder.indexOf(tx.status);
    return stepKeys.map((key, i) => makeStep(key, i <= currentIdx && currentIdx !== -1));
  }

  async markSettled(transactionId: string, mpesaReceipt: string): Promise<void> {
    await transactionStore.update(transactionId, {
      status: 'SETTLED',
      mpesaReceiptNumber: mpesaReceipt,
      settledAt: new Date().toISOString(),
    });
    logger.info('PAYMENT', `Transaction SETTLED`, transactionId, { mpesaReceipt });
  }

  async markFailed(transactionId: string, reason: string): Promise<void> {
    await transactionStore.update(transactionId, {
      status: 'FAILED',
      failureReason: reason,
      failedAt: new Date().toISOString(),
    });
    logger.userError(transactionId, 'TXN_FAILED', 'Transaction failed - funds will be returned', reason);
  }

  private async failTransaction(transactionId: string, reason: string): Promise<void> {
    await this.markFailed(transactionId, reason);
  }

  protected async pollUntil<T>(
    fn: () => Promise<T>,
    isDone: (v: T) => boolean,
    timeoutMs: number,
    intervalMs: number
  ): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await fn();
      if (isDone(result)) return result;
      await sleep(intervalMs);
    }
    return null;
  }
}

class RealPaymentService extends SimulatedPaymentService {
  /**
   * Production pipeline swaps simulated delays for real service calls
   */
  async processPaymentPipeline(transactionId: string): Promise<void> {
    const tx = await transactionStore.get(transactionId);
    if (!tx || !tx.txHash) return;

    const log = (step: number, msg: string) => logger.pipelineStep(transactionId, step, 4, msg);

    try {
      // Step 1: Verify WLD on-chain
      log(1, 'Verifying WLD transfer on World Chain...');
      const amountBigInt = BigInt(Math.floor(parseFloat(tx.wldAmount) * 1e18));
      const confirmed = await worldChainListener.waitForWldTransfer(
        tx.payToAddress,
        amountBigInt,
        tx.txHash
      );

      if (!confirmed) {
        logger.userError(transactionId, 'BLOCKCHAIN_CONFIRM_FAILED', 
          'Payment could not be verified on the blockchain', 
          'On-chain WLD transfer could not be verified');
        throw new Error('On-chain WLD transfer could not be verified');
      }
      
      await transactionStore.update(transactionId, { status: 'CONFIRMED' });
      log(1, '✓ WLD confirmed on World Chain');

      // Step 2: Local Liquidity Rebalancing (Automated DEX Swap)
      // Swap WLD -> USDC to prepare liquidity for off-ramp
      log(2, 'Rebalancing liquidity (WLD → USDC)...');
      let swapHash: string | null = null;
      try {
        const { swapService } = await import('./swapService');
        swapHash = await swapService.swapWldForUsdc(tx.wldAmount);
        logger.dexOperation(transactionId, 'Swap completed', tx.wldAmount, 'WLD', swapHash);
        log(2, `✓ Rebalanced: ${swapHash.slice(0, 10)}...${swapHash.slice(-6)}`);
      } catch (swapErr) {
        // Log but continue - we can still try off-ramp with existing liquidity
        const errorMsg = swapErr instanceof Error ? swapErr.message : 'Unknown error';
        logger.warn('DEX', 'Rebalancing failed (continuing with existing liquidity)', transactionId, { error: errorMsg });
      }

      // Step 3: Off-ramp / Payout via Bitnob
      // Now that we have USDC liquidity, initiate the payout
      log(3, `Initiating ${formatTransactionType(tx.transactionType)} via Bitnob...`);
      const payout = await offrampService.initiateSwap(tx.wldAmount, tx.kesAmount, transactionId);
      await transactionStore.update(transactionId, {
        status: 'OFFRAMP_INITIATED',
        offrampId: payout.swapId
      });

      log(3, `✓ Bitnob payout queued [${payout.swapId.slice(0, 8)}...]`);

      // Step 4: Finalize
      // Note: Bitnob handles the actual disbursement. We wait for their callback 
      // or poll to mark it as SETTLED.
      log(4, 'Waiting for Bitnob to complete disbursement...');
      const bitnobStatus = await this.pollUntil(
        () => offrampService.checkSwapStatus(payout.swapId, transactionId),
        (s) => s === 'COMPLETED' || s === 'FAILED',
        180_000, // 3 min timeout
        10_000   // 10s interval
      );

      if (bitnobStatus !== 'COMPLETED') {
        logger.userError(transactionId, 'BITNOB_PAYOUT_FAILED', 
          'MPESA disbursement failed - your WLD will be refunded',
          'Bitnob payout failed or timed out');
        throw new Error('Bitnob payout failed or timed out');
      }

      await transactionStore.update(transactionId, {
        status: 'SETTLED',
        settledAt: new Date().toISOString(),
      });

      log(4, '✓ SETTLED - Funds sent to recipient');
      logger.info('PAYMENT', 'Transaction completed successfully', transactionId, {
        kesAmount: formatAmount(tx.kesAmount),
        swapHash: swapHash ? `${swapHash.slice(0, 10)}...${swapHash.slice(-6)}` : 'skipped',
        destination: tx.transactionType === 'send' || tx.transactionType === 'pochi'
          ? maskPhoneNumber(tx.phoneNumber)
          : tx.transactionType === 'paybill'
          ? `Paybill ${tx.tillNumber}`
          : `Till ${tx.tillNumber}`,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown production pipeline error';
      logger.error('PAYMENT', `Pipeline critical failure: ${msg}`, transactionId, err);
      await this.markFailed(transactionId, msg);
    }
  }
}

export function createPaymentService(): IPaymentService {
  return new RealPaymentService();
}

export const paymentService = createPaymentService();
