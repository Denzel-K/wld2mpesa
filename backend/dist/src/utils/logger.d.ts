/**
 * logger.ts — Structured logging utility
 *
 * Provides consistent, safe logging across the application.
 * Masks sensitive data (phone numbers, API keys) and categorizes logs.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'PAYMENT' | 'PIPELINE' | 'BITNOB' | 'BLOCKCHAIN' | 'DEX' | 'WEBHOOK' | 'API' | 'DATABASE' | 'REFUND' | 'RECONCILIATION' | 'SECURITY' | 'SYSTEM' | 'ADMIN';
/**
 * Mask sensitive phone numbers - show only last 4 digits
 * Example: 254712345678 → 2547••••5678
 */
export declare function maskPhoneNumber(phone: string | null | undefined): string;
/**
 * Mask wallet address - show first 6 and last 4 characters
 * Example: 0x1234567890abcdef... → 0x1234...cdef
 */
export declare function maskWalletAddress(address: string | null | undefined): string;
/**
 * Mask API key - show only first 8 and last 4 characters
 */
export declare function maskApiKey(key: string | null | undefined): string;
/**
 * Format transaction type for display
 */
export declare function formatTransactionType(type: string): string;
/**
 * Format amount with currency
 */
export declare function formatAmount(amount: number | string, currency?: string): string;
declare class Logger {
    private isDevelopment;
    constructor();
    private log;
    /**
     * Remove sensitive data from metadata
     */
    private sanitizeMetadata;
    debug(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void;
    info(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void;
    warn(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void;
    error(category: LogCategory, message: string, transactionId?: string, error?: unknown): void;
    /**
     * Log payment initiation with masked sensitive data
     */
    paymentInitiated(transactionId: string, type: string, amount: number, recipient: string): void;
    /**
     * Log pipeline step progress
     */
    pipelineStep(transactionId: string, step: number, totalSteps: number, description: string): void;
    /**
     * Log blockchain transaction
     */
    blockchainTx(transactionId: string, action: string, txHash?: string, details?: Record<string, unknown>): void;
    /**
     * Log Bitnob operation
     */
    bitnobOperation(transactionId: string, operation: string, payoutId?: string, details?: Record<string, unknown>): void;
    /**
     * Log DEX swap operation
     */
    dexOperation(transactionId: string, action: string, amount: string, token: string, txHash?: string): void;
    /**
     * Log user-friendly error with actionable message
     */
    userError(transactionId: string | undefined, code: string, message: string, technicalDetails?: string): void;
    /**
     * Structured audit event — immutable record of a significant pipeline event.
     * All fields are sanitized. Suitable for compliance and reconciliation.
     */
    auditEvent(transactionId: string, event: string, phase: 'INITIATION' | 'BLOCKCHAIN' | 'DEX_SWAP' | 'OFFRAMP' | 'MPESA' | 'SETTLEMENT' | 'REFUND' | 'FAILURE', details: Record<string, unknown>): void;
    /**
     * Log refund initiation
     */
    refundInitiated(transactionId: string, walletAddress: string, wldAmount: string, reason: string): void;
    /**
     * Log successful refund completion
     */
    refundCompleted(transactionId: string, walletAddress: string, wldAmount: string, refundTxHash?: string): void;
    /**
     * Log refund failure — requires manual intervention
     */
    refundFailed(transactionId: string, walletAddress: string, wldAmount: string, reason: string): void;
    /**
     * Log reconciliation alert — discrepancy between expected and actual state
     */
    reconciliationAlert(transactionId: string, field: string, expected: unknown, actual: unknown): void;
    /**
     * Log security event (unauthorized access, suspicious pattern)
     */
    securityEvent(event: string, details: Record<string, unknown>): void;
    /**
     * Print a startup banner summarising system configuration.
     * Call once from server.ts after env validation.
     */
    startupBanner(mode: string, hasAdminKey: boolean, hasBitnob: boolean, hasMpesa: boolean): void;
    /**
     * Divider line — visually separates pipeline runs in console output.
     */
    pipelineDivider(transactionId: string, action: 'START' | 'END' | 'RETRY'): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map