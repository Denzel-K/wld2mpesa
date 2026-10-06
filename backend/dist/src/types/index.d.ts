/**
 * types/index.ts — Shared TypeScript types for the entire backend
 *
 * Single source of truth for all domain types.
 * All services, routes, and scripts import from here.
 */
export type TransactionStatus = 'INITIATED' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'SWAP_COMPLETED' | 'OFFRAMP_INITIATED' | 'MPESA_SENT' | 'SETTLED' | 'FAILED';
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
    wldAmount: string;
    feeWld: string;
    feeKes: number;
    wldRate: string;
    payToAddress: string;
    platformFeeKes?: number | null;
    safaricomFeeKes?: number | null;
    gasBufferKes?: number | null;
    bitnobFeeKes?: number | null;
    dexFeeKes?: number | null;
    netPlatformRevenueKes?: number | null;
    txHash?: string | null;
    offrampId?: string | null;
    mpesaConversationId?: string | null;
    mpesaReceiptNumber?: string | null;
    worldIdProof?: any;
    createdAt: string;
    confirmedAt?: string | null;
    offrampAt?: string | null;
    mpesaSentAt?: string | null;
    settledAt?: string | null;
    failedAt?: string | null;
    failureReason?: string | null;
    refundStatus?: 'REFUND_INITIATED' | 'REFUNDED' | 'REFUND_FAILED' | null;
    refundTxHash?: string | null;
    refundAt?: string | null;
    miniKitPayload?: any;
    userId?: string | null;
}
export interface RateData {
    wldPriceKes: number;
    wldPriceUsd: number;
    usdKesRate: number;
    source: string;
    cachedAt: string;
}
export interface User {
    id: string;
    walletAddress: string;
    nullifierHash?: string | null;
    wldUsername?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    profileComplete: boolean;
    verificationLevel?: string | null;
    isVerified: boolean;
    onboarded: boolean;
    createdAt: string;
    lastSeenAt: string;
}
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
    initiateRefund(transactionId: string, walletAddress: string): Promise<void>;
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
    refundStatus?: 'REFUND_INITIATED' | 'REFUNDED' | 'REFUND_FAILED' | null;
    refundTxHash?: string | null;
    refundAt?: string | null;
}
export interface IOfframpService {
    initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult>;
    checkSwapStatus(swapId: string, reference?: string): Promise<SwapStatus>;
}
export interface SwapResult {
    swapId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    estimatedKes?: number;
}
export type SwapStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
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
export interface IWorldChainListener {
    waitForWldTransfer(toAddress: string, expectedAmount: bigint, txHash: string): Promise<boolean>;
    getWldBalance(walletAddress: string): Promise<string>;
}
export interface IRateService {
    getWldKesRate(): Promise<RateData>;
}
//# sourceMappingURL=index.d.ts.map