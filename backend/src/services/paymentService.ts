/**
 * paymentService.ts — CORE: Payment orchestration
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { rateService } from './rateService';
import { transactionStore } from './transactionStore';
import { worldChainListener } from './worldChainListener';
import { offrampService } from './offrampService';
import { mpesaService } from './mpesaService';
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
    console.log(`[SIM] ${transactionType} initiated: ${tx.id} | KES ${kesAmount} → ${wldAmount} WLD`);

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

    console.log(`[SIM] Payment confirmed: ${transactionId} — txHash ${txHash}`);
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

    const log = (msg: string) => console.log(`[PIPELINE:${transactionId}] ${msg}`);

    try {
      log('Step 1: Waiting for WLD confirmation…');
      await sleep(config.SIM_BLOCK_CONFIRM_MS);
      await transactionStore.update(transactionId, { status: 'CONFIRMED' });
      log('Step 1 ✓ WLD received');

      log('Step 2: Off-ramp WLD → KES…');
      await transactionStore.update(transactionId, { status: 'OFFRAMP_INITIATED' });
      await sleep(config.SIM_OFFRAMP_MS);
      log('Step 2 ✓ Off-ramp completed');

      const destination = tx.transactionType === 'send' || tx.transactionType === 'pochi'
        ? tx.phoneNumber!
        : tx.tillNumber!;

      log(`Step 3: Sending KES ${tx.kesAmount} to ${tx.transactionType} ${destination}…`);
      await transactionStore.update(transactionId, { status: 'MPESA_SENT' });
      await sleep(config.SIM_MPESA_MS);

      const receiptNumber = `RGX${Date.now().toString().slice(-8)}`;

      await transactionStore.update(transactionId, {
        status: 'SETTLED',
        mpesaReceiptNumber: receiptNumber,
        settledAt: new Date().toISOString(),
      });

      log(`Step 4 ✓ SETTLED — Receipt: ${receiptNumber}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown pipeline error';
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
    const statusOrder: Transaction['status'][] = ['CONFIRMED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'];
    const stepKeys = ['WLD_RECEIVED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'];
    const currentIdx = statusOrder.indexOf(tx.status);
    return stepKeys.map((key, i) => makeStep(key, i <= currentIdx && currentIdx !== -1));
  }

  async markSettled(transactionId: string, mpesaReceipt: string): Promise<void> {
    await transactionStore.update(transactionId, {
      status: 'SETTLED',
      mpesaReceiptNumber: mpesaReceipt,
      settledAt: new Date().toISOString(),
    });
    console.log(`[PaymentService] Transaction ${transactionId} SETTLED with receipt ${mpesaReceipt}`);
  }

  async markFailed(transactionId: string, reason: string): Promise<void> {
    await transactionStore.update(transactionId, {
      status: 'FAILED',
      failureReason: reason,
      failedAt: new Date().toISOString(),
    });
    console.warn(`[PaymentService] Transaction ${transactionId} FAILED: ${reason}`);
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

    const log = (msg: string) => console.log(`[PROD-PIPELINE:${transactionId}] ${msg}`);

    try {
      // Step 1: Verify WLD on-chain
      log('Step 1: Verifying WLD transfer on World Chain...');
      const amountBigInt = BigInt(Math.floor(parseFloat(tx.wldAmount) * 1e18));
      const confirmed = await worldChainListener.waitForWldTransfer(
        tx.payToAddress,
        amountBigInt,
        tx.txHash
      );

      if (!confirmed) throw new Error('On-chain WLD transfer could not be verified');
      await transactionStore.update(transactionId, { status: 'CONFIRMED' });
      log('Step 1 ✓ WLD confirmed');

      // Step 2: Off-ramp via Yellow Card
      log('Step 2: Initiating Yellow Card off-ramp...');
      const swap = await offrampService.initiateSwap(tx.wldAmount, tx.kesAmount, transactionId);
      await transactionStore.update(transactionId, {
        status: 'OFFRAMP_INITIATED',
        offrampId: swap.swapId
      });

      // Poll/wait for Yellow Card completion (typically ~2-5 mins)
      const ycStatus = await this.pollUntil(
        () => offrampService.checkSwapStatus(swap.swapId),
        (s) => s === 'COMPLETED' || s === 'FAILED',
        180_000, // 3 min timeout
        10_000   // 10s interval
      );

      if (ycStatus !== 'COMPLETED') {
        throw new Error('Yellow Card off-ramp failed or timed out');
      }
      log('Step 2 ✓ Off-ramp completed');

      // Step 3: M-Pesa Disbursement
      log('Step 3: Initiating M-Pesa B2B disbursement...');
      const destination = tx.transactionType === 'send' || tx.transactionType === 'pochi'
        ? tx.phoneNumber!
        : tx.tillNumber!;

      const mpesa = await mpesaService.sendToTill(destination, tx.kesAmount, transactionId);
      await transactionStore.update(transactionId, {
        status: 'MPESA_SENT',
        mpesaConversationId: mpesa.requestId
      });

      // We DON'T wait here — we let the webhooks/markSettled handle the final step
      log('Step 3 ✓ Disbursement initiated. Awaiting M-Pesa callback...');

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown production pipeline error';
      console.error(`[PROD-PIPELINE:${transactionId}] CRITICAL FAILURE:`, err);
      await this.markFailed(transactionId, msg);
    }
  }
}

export function createPaymentService(): IPaymentService {
  return new RealPaymentService();
}

export const paymentService = createPaymentService();
