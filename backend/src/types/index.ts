/**
 * types/index.ts — Shared TypeScript types for the entire backend
 *
 * Single source of truth for all domain types.
 * All services, routes, and scripts import from here.
 */

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionStatus =
  | 'INITIATED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'OFFRAMP_INITIATED'
  | 'MPESA_SENT'
  | 'SETTLED'
  | 'FAILED';

export interface TransactionStep {
  step: string;
  timestamp: string;
  done: boolean;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  transactionType: 'send' | 'paybill' | 'pochi' | 'till';
  kesAmount: number;
  tillNumber?: string | null;
  phoneNumber?: string | null;
  accountNumber?: string | null;
  walletAddress: string;

  // WLD fields
  wldAmount: string;
  feeWld: string;
  feeKes: number;
  wldRate: string;
  payToAddress: string;

  // Hashes / IDs
  txHash?: string | null;
  offrampId?: string | null;
  mpesaConversationId?: string | null;
  mpesaReceiptNumber?: string | null;

  // World ID
  worldIdProof?: any;

  // Timestamps
  createdAt: string;
  confirmedAt?: string | null;
  offrampAt?: string | null;
  mpesaSentAt?: string | null;
  settledAt?: string | null;
  failedAt?: string | null;

  failureReason?: string | null;

  // miniKit payload (stored for audit)
  miniKitPayload?: any;
  userId?: string | null;
}

// ─── Rate data ────────────────────────────────────────────────────────────────

export interface RateData {
  wldPriceKes: number;
  wldPriceUsd: number;
  usdKesRate: number;
  source: string;
  cachedAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  walletAddress: string;
  nullifierHash?: string | null;
  name?: string | null;
  verificationLevel?: string | null;
  isVerified: boolean;
  onboarded: boolean;
  createdAt: string;
  lastSeenAt: string;
}

// ─── Service interfaces (dependency injection) ────────────────────────────────

/**
 * IPaymentService — implemented by SimulatedPaymentService and RealPaymentService
 */
export interface IPaymentService {
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult>;
  getTransactionStatus(transactionId: string): Promise<TransactionStatusResult>;
  processPaymentPipeline(transactionId: string): Promise<void>;
  markSettled(transactionId: string, mpesaReceipt: string): Promise<void>;
  markFailed(transactionId: string, reason: string): Promise<void>;
}

export interface InitiatePaymentParams {
  transactionType: 'send' | 'paybill' | 'pochi' | 'till';
  kesAmount: number;
  tillNumber?: string;
  phoneNumber?: string;
  accountNumber?: string;
  walletAddress: string;
  worldIdProof?: unknown;
}

export interface InitiatePaymentResult {
  transactionId: string;
  wldAmount: string;
  feeWld: string;
  feeKes: number;
  rate: string;
  expiresAt: string;
  payToAddress: string;
}

export interface ConfirmPaymentParams {
  transactionId: string;
  txHash: string;
  miniKitPayload: unknown;
}

export interface ConfirmPaymentResult {
  transactionId: string;
  status: TransactionStatus;
  estimatedSettlementMinutes: number;
}

export interface TransactionStatusResult {
  transactionId: string;
  status: TransactionStatus;
  transactionType: 'send' | 'paybill' | 'pochi' | 'till';
  kesAmount: number;
  tillNumber?: string | null;
  phoneNumber?: string | null;
  accountNumber?: string | null;
  mpesaReceiptNumber?: string | null;
  settledAt?: string | null;
  failureReason?: string | null;
  steps: TransactionStep[];
}

// ─── Off-ramp service ─────────────────────────────────────────────────────────

export interface IOfframpService {
  initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult>;
  checkSwapStatus(swapId: string): Promise<SwapStatus>;
}

export interface SwapResult {
  swapId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  estimatedKes?: number;
}

export type SwapStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

// ─── M-Pesa service ───────────────────────────────────────────────────────────

export interface IMpesaService {
  sendToTill(tillNumber: string, kesAmount: number, txnId: string): Promise<MpesaResult>;
  checkPaymentStatus(requestId: string): Promise<MpesaPaymentStatus>;
}

export interface MpesaResult {
  requestId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  receiptNumber?: string;
}

export type MpesaPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

// ─── World Chain listener ─────────────────────────────────────────────────────

export interface IWorldChainListener {
  waitForWldTransfer(
    toAddress: string,
    expectedAmount: bigint,
    txHash: string
  ): Promise<boolean>;
  getWldBalance(walletAddress: string): Promise<string>;
}

// ─── Rate service ─────────────────────────────────────────────────────────────

export interface IRateService {
  getWldKesRate(): Promise<RateData>;
}
