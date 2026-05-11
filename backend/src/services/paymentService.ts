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
  feePercent: number,
  gasBufferKes: number = 0
): { wldAmount: string; feeWld: string; feeKes: number; platformFee: number; safaricomFee: number; gasBuffer: number } {
  const platformFee = parseFloat(((kesAmount * feePercent) / 100).toFixed(2));
  const safaricomFee = getMpesaFees(kesAmount);
  const feeKes = parseFloat((platformFee + safaricomFee + gasBufferKes).toFixed(2));
  const totalKes = kesAmount + feeKes;
  const wldAmount = parseFloat((totalKes / wldPriceKes).toFixed(6)).toString();
  const feeWld = parseFloat((feeKes / wldPriceKes).toFixed(6)).toString();
  return { wldAmount, feeWld, feeKes, platformFee, safaricomFee, gasBuffer: gasBufferKes };
}


class PaymentService implements IPaymentService {
  /**
   * Processes payment through the full pipeline:
   * 1. Verify WLD on-chain
   * 2. DEX swap (WLD → USDC)
   * 3. Off-ramp via Bitnob
   * 4. Wait for M-Pesa disbursement
   */
  async processPaymentPipeline(transactionId: string): Promise<void> {
    const tx = await transactionStore.get(transactionId);
    if (!tx || !tx.txHash) return;

    const log = (step: number, msg: string) => logger.pipelineStep(transactionId, step, 4, msg);

    // Statuses considered already past blockchain confirmation
    const PAST_CONFIRMATION = ['CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
    const isRetry = PAST_CONFIRMATION.includes(tx.status);
    logger.pipelineDivider(transactionId, isRetry ? 'RETRY' : 'START');
    logger.auditEvent(transactionId, isRetry ? 'PIPELINE_RETRY_STARTED' : 'PIPELINE_STARTED', 'INITIATION', {
      mode: 'PRODUCTION',
      currentStatus: tx.status,
      wldAmount: tx.wldAmount,
      kesAmount: formatAmount(tx.kesAmount),
    });
    const PAST_SWAP = ['SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
    const PAST_OFFRAMP = ['MPESA_SENT'];

    try {
      // Step 1: Verify WLD on-chain (skip if already confirmed)
      if (PAST_CONFIRMATION.includes(tx.status)) {
        log(1, `↩ Skipping blockchain confirmation — status already: ${tx.status}`);
      } else {
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
      }

      // Step 2: Local Liquidity Rebalancing (skip if already done)
      let swapHash: string | null = null;
      if (PAST_SWAP.includes(tx.status)) {
        log(2, `↩ Skipping DEX swap — status already: ${tx.status}`);
      } else {
        log(2, 'Rebalancing liquidity (WLD → USDC)...');
        try {
          const { swapService } = await import('./swapService');
          swapHash = await swapService.swapWldForUsdc(tx.wldAmount);
          logger.dexOperation(transactionId, 'Swap completed', tx.wldAmount, 'WLD', swapHash);
          log(2, `✓ Rebalanced: ${swapHash.slice(0, 10)}...${swapHash.slice(-6)}`);
        } catch (swapErr) {
          const errorMsg = swapErr instanceof Error ? swapErr.message : 'Unknown error';
          logger.warn('DEX', 'Rebalancing failed (continuing with existing liquidity)', transactionId, { error: errorMsg });
        }
      }

      // Step 3: Off-ramp / Payout via Bitnob (skip if already initiated)
      let payoutSwapId: string = tx.offrampId ?? '';
      if (PAST_OFFRAMP.includes(tx.status) && tx.offrampId) {
        log(3, `↩ Skipping off-ramp initiation — already initiated: ${tx.offrampId.slice(0, 8)}...`);
        payoutSwapId = tx.offrampId;
      } else {
        log(3, `Initiating ${formatTransactionType(tx.transactionType)} via Bitnob...`);
        const payout = await offrampService.initiateSwap(tx.wldAmount, tx.kesAmount, transactionId);
        payoutSwapId = payout.swapId;
        await transactionStore.update(transactionId, {
          status: 'OFFRAMP_INITIATED',
          offrampId: payoutSwapId
        });
        log(3, `✓ Bitnob payout queued [${payoutSwapId.slice(0, 8)}...]`);
      }

      // Step 4: Finalize
      // Note: Bitnob handles the actual disbursement. We wait for their callback 
      // or poll to mark it as SETTLED.
      log(4, 'Waiting for Bitnob to complete disbursement...');
      const bitnobStatus = await this.pollUntil(
        () => offrampService.checkSwapStatus(payoutSwapId, transactionId),
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
      logger.pipelineDivider(transactionId, 'END');
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
      logger.auditEvent(transactionId, 'PIPELINE_FAILED', 'FAILURE', { reason: msg, mode: 'PRODUCTION' });
      logger.pipelineDivider(transactionId, 'END');
      await this.markFailed(transactionId, msg);
    }
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { transactionType, kesAmount, tillNumber, phoneNumber, accountNumber, walletAddress } = params;

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

    const rate = await rateService.getWldKesRate();
    const { wldAmount, feeWld, feeKes, platformFee, safaricomFee, gasBuffer } = calculateWldAmount(
      kesAmount,
      rate.wldPriceKes,
      config.FEE_PERCENT,
      config.GAS_BUFFER_KES
    );

    const tx: Transaction = {
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

    const recipient = transactionType === 'send' || transactionType === 'pochi'
      ? maskPhoneNumber(phoneNumber)
      : transactionType === 'paybill'
      ? `Paybill ${tillNumber} (Acct: ${accountNumber?.slice(0, 3)}...)`
      : `Till ${tillNumber}`;

    logger.paymentInitiated(tx.id, transactionType, kesAmount, recipient);
    logger.info('PAYMENT', `Rate: 1 WLD = ${formatAmount(rate.wldPriceKes)} | Total fee: KSh ${formatAmount(feeKes)}`, tx.id, {
      wldAmount: `${wldAmount} WLD`,
      payToAddress: maskWalletAddress(config.BACKEND_WALLET_ADDRESS),
      feeBreakdown: {
        platformFee: `KSh ${formatAmount(platformFee)} (${config.FEE_PERCENT}%)`,
        safaricomFee: `KSh ${formatAmount(safaricomFee)}`,
        gasBuffer: `KSh ${formatAmount(gasBuffer)} (World Chain L2 ETH gas absorption)`,
        totalFeeKes: `KSh ${formatAmount(feeKes)}`,
        totalFeeWld: `${feeWld} WLD`,
      },
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
    const steps: TransactionStep[] = [
      {
        step: 'WLD_RECEIVED',
        timestamp: tx.confirmedAt ?? tx.createdAt,
        done: ['CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
      },
      {
        step: 'DEX_SWAP',
        timestamp: tx.confirmedAt ?? tx.createdAt,
        done: ['SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
      },
      {
        step: 'OFFRAMP_INITIATED',
        timestamp: tx.offrampAt ?? tx.confirmedAt ?? tx.createdAt,
        done: ['OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
      },
      {
        step: 'MPESA_SENT',
        timestamp: tx.mpesaSentAt ?? tx.offrampAt ?? tx.createdAt,
        done: ['MPESA_SENT', 'SETTLED'].includes(tx.status),
      },
      {
        step: 'SETTLED',
        timestamp: tx.settledAt ?? tx.createdAt,
        done: tx.status === 'SETTLED',
      },
    ];
    return steps;
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

  async initiateRefund(transactionId: string, walletAddress: string): Promise<void> {
    const tx = await transactionStore.get(transactionId);
    if (!tx) throw new Error(`Transaction not found: ${transactionId}`);

    if (tx.refundStatus === 'REFUND_INITIATED') {
      logger.warn('REFUND', 'Duplicate refund attempt blocked — refund already in-flight', transactionId, {
        wallet: maskWalletAddress(walletAddress),
        currentRefundStatus: tx.refundStatus,
      });
      throw new Error('A refund is already in progress for this transaction. Please wait.');
    }
    if (tx.refundStatus === 'REFUNDED' && tx.refundTxHash) {
      logger.warn('REFUND', 'Duplicate refund attempt blocked — already refunded on-chain', transactionId, {
        wallet: maskWalletAddress(walletAddress),
        refundTxHash: tx.refundTxHash.slice(0, 12),
      });
      throw new Error('This transaction has already been refunded on-chain.');
    }

    if (!tx.wldAmount || parseFloat(tx.wldAmount) <= 0) {
      logger.error('REFUND', 'Cannot refund — wldAmount is missing or zero', transactionId);
      throw new Error('Cannot process refund: WLD amount is not recorded for this transaction.');
    }

    logger.refundInitiated(transactionId, walletAddress, tx.wldAmount, tx.failureReason || 'User-requested conflict resolution');
    logger.auditEvent(transactionId, 'REFUND_REQUESTED', 'REFUND', {
      wallet: maskWalletAddress(walletAddress),
      wldAmount: tx.wldAmount,
      kesAmount: formatAmount(tx.kesAmount),
      originalStatus: tx.status,
    });

    await transactionStore.update(transactionId, {
      status: 'FAILED',
      failureReason: tx.failureReason || 'Refund requested',
      failedAt: tx.failedAt || new Date().toISOString(),
      refundStatus: 'REFUND_INITIATED',
      refundAt: new Date().toISOString(),
    });

    void this.processRefundPipeline(transactionId, walletAddress, tx.wldAmount);
  }

  private async processRefundPipeline(transactionId: string, walletAddress: string, wldAmount: string): Promise<void> {
    logger.pipelineDivider(transactionId, 'START');
    logger.pipelineStep(transactionId, 0, 1, `Processing refund of ${wldAmount} WLD → ${maskWalletAddress(walletAddress)}`);

    if (!config.ADMIN_PRIVATE_KEY) {
      const msg = 'ADMIN_PRIVATE_KEY not configured — on-chain refund cannot be executed';
      logger.error('REFUND', msg, transactionId);
      await transactionStore.update(transactionId, { refundStatus: 'REFUND_FAILED' });
      logger.refundFailed(transactionId, walletAddress, wldAmount, msg);
      logger.userError(transactionId, 'REFUND_FAILED',
        'Automatic refund could not be processed. Please contact support at support@wld2mpesa.app',
        msg
      );
      return;
    }

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(config.WORLD_CHAIN_RPC_URL);
      const signer = new ethers.Wallet(config.ADMIN_PRIVATE_KEY, provider);

      const erc20Abi = ['function transfer(address to, uint256 amount) public returns (bool)'];
      const wldContract = new ethers.Contract(config.WLD_CONTRACT_ADDRESS, erc20Abi, signer);

      const amountWei = ethers.parseUnits(wldAmount, 18);
      logger.info('REFUND', `Sending ${wldAmount} WLD on-chain to ${maskWalletAddress(walletAddress)}`, transactionId);

      const tx = await wldContract.transfer(walletAddress, amountWei);
      logger.info('REFUND', `Refund tx broadcast: ${tx.hash.slice(0, 12)}...${tx.hash.slice(-6)}`, transactionId);

      const receipt = await tx.wait(1);
      const refundTxHash: string = receipt?.hash ?? tx.hash;

      await transactionStore.update(transactionId, {
        refundStatus: 'REFUNDED',
        refundTxHash,
        refundAt: new Date().toISOString(),
      });
      logger.refundCompleted(transactionId, walletAddress, wldAmount, refundTxHash);
      logger.auditEvent(transactionId, 'REFUND_COMPLETED', 'REFUND', {
        wallet: maskWalletAddress(walletAddress),
        wldAmount,
        refundTxHash: `${refundTxHash.slice(0, 12)}...${refundTxHash.slice(-6)}`,
      });
      logger.pipelineDivider(transactionId, 'END');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown refund error';
      await transactionStore.update(transactionId, { refundStatus: 'REFUND_FAILED' });
      logger.refundFailed(transactionId, walletAddress, wldAmount, msg);
      logger.userError(transactionId, 'REFUND_FAILED',
        'Automatic refund could not be processed. Please contact support at support@wld2mpesa.app',
        msg
      );
      logger.pipelineDivider(transactionId, 'END');
    }
  }

  private async pollUntil<T>(
    fn: () => Promise<T>,
    isDone: (v: T) => boolean,
    timeoutMs: number,
    intervalMs: number
  ): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await fn();
      if (isDone(result)) return result;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }
}

export function createPaymentService(): IPaymentService {
  return new PaymentService();
}

export const paymentService = createPaymentService();
