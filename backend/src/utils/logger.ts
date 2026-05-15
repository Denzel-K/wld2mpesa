/**
 * logger.ts — Structured logging utility
 *
 * Provides consistent, safe logging across the application.
 * Masks sensitive data (phone numbers, API keys) and categorizes logs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'PAYMENT' | 'PIPELINE' | 'BITNOB' | 'BLOCKCHAIN' | 'DEX' | 'WEBHOOK' | 'API' | 'DATABASE' | 'REFUND' | 'RECONCILIATION' | 'SECURITY' | 'SYSTEM' | 'ADMIN';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mask sensitive phone numbers - show only last 4 digits
 * Example: 254712345678 → 2547••••5678
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 4) return '•'.repeat(clean.length);
  return clean.slice(0, 4) + '•'.repeat(clean.length - 8) + clean.slice(-4);
}

/**
 * Mask wallet address - show first 6 and last 4 characters
 * Example: 0x1234567890abcdef... → 0x1234...cdef
 */
export function maskWalletAddress(address: string | null | undefined): string {
  if (!address) return 'N/A';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Mask API key - show only first 8 and last 4 characters
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return 'N/A';
  if (key.length < 12) return '•'.repeat(key.length);
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * Format transaction type for display
 */
export function formatTransactionType(type: string): string {
  const types: Record<string, string> = {
    'send': 'Send Money',
    'pochi': 'Pochi la Biashara',
    'paybill': 'Paybill Payment',
    'till': 'Buy Goods (Till)',
  };
  return types[type] || type;
}

/**
 * Format amount with currency
 */
export function formatAmount(amount: number | string, currency: string = 'KES'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${currency}`;
  return `${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private log(level: LogLevel, category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      transactionId,
      metadata: this.sanitizeMetadata(metadata),
    };

    const LEVEL_PREFIX: Record<LogLevel, string> = {
      debug: '\x1b[2m[DBG]\x1b[0m',
      info:  '\x1b[36m[INF]\x1b[0m',
      warn:  '\x1b[33m[WRN]\x1b[0m',
      error: '\x1b[31m[ERR]\x1b[0m',
    };
    const CAT_COLOR: Partial<Record<LogCategory, string>> = {
      REFUND:         '\x1b[33m',
      RECONCILIATION: '\x1b[35m',
      PIPELINE:       '\x1b[36m',
      BLOCKCHAIN:     '\x1b[34m',
      DEX:            '\x1b[34m',
      SECURITY:       '\x1b[31m',
      PAYMENT:        '\x1b[32m',
    };
    const catColor = CAT_COLOR[category] ?? '';
    const reset = '\x1b[0m';

    const prefix = `${LEVEL_PREFIX[level]} ${catColor}[${category}]${reset}${transactionId ? ` \x1b[2m[${transactionId.slice(-12)}]\x1b[0m` : ''}`;
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    if (metadata && Object.keys(metadata).length > 0) {
      logFn(`${prefix} ${message}`, entry.metadata);
    } else {
      logFn(`${prefix} ${message}`);
    }
  }

  /**
   * Remove sensitive data from metadata
   */
  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Skip sensitive keys entirely
      if (['apiKey', 'privateKey', 'secret', 'password', 'token', 'authorization'].includes(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
        continue;
      }
      
      // Mask phone numbers
      if (key.toLowerCase().includes('phone') && typeof value === 'string') {
        sanitized[key] = maskPhoneNumber(value);
        continue;
      }
      
      // Mask wallet addresses
      if ((key.toLowerCase().includes('address') || key.toLowerCase().includes('wallet')) && typeof value === 'string') {
        sanitized[key] = maskWalletAddress(value);
        continue;
      }
      
      // Mask txHash partially (show first 10 and last 6)
      if (key.toLowerCase().includes('hash') && typeof value === 'string' && value.startsWith('0x')) {
        sanitized[key] = `${value.slice(0, 10)}...${value.slice(-6)}`;
        continue;
      }
      
      sanitized[key] = value;
    }
    
    return sanitized;
  }

  debug(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      this.log('debug', category, message, transactionId, metadata);
    }
  }

  info(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void {
    this.log('info', category, message, transactionId, metadata);
  }

  warn(category: LogCategory, message: string, transactionId?: string, metadata?: Record<string, unknown>): void {
    this.log('warn', category, message, transactionId, metadata);
  }

  error(category: LogCategory, message: string, transactionId?: string, error?: unknown): void {
    const metadata = error instanceof Error 
      ? { error: error.message, stack: this.isDevelopment ? error.stack : undefined }
      : { error };
    this.log('error', category, message, transactionId, metadata);
  }

  // ─── Payment Pipeline Specific Methods ────────────────────────────────────

  /**
   * Log payment initiation with masked sensitive data
   */
  paymentInitiated(transactionId: string, type: string, amount: number, recipient: string): void {
    this.info('PAYMENT', `Payment initiated: ${formatTransactionType(type)} ${formatAmount(amount)}`, transactionId, {
      type,
      amount,
      recipient: maskPhoneNumber(recipient),
    });
  }

  /**
   * Log pipeline step progress
   */
  pipelineStep(transactionId: string, step: number, totalSteps: number, description: string): void {
    const bar = Array.from({ length: totalSteps }, (_, i) => i < step ? '█' : '░').join('');
    this.info('PIPELINE', `[${bar}] ${step}/${totalSteps} ${description}`, transactionId);
  }

  /**
   * Log blockchain transaction
   */
  blockchainTx(transactionId: string, action: string, txHash?: string, details?: Record<string, unknown>): void {
    this.info('BLOCKCHAIN', `${action}${txHash ? ` (${maskWalletAddress(txHash)})` : ''}`, transactionId, details);
  }

  /**
   * Log Bitnob operation
   */
  bitnobOperation(transactionId: string, operation: string, payoutId?: string, details?: Record<string, unknown>): void {
    this.info('BITNOB', `${operation}${payoutId ? ` [${payoutId.slice(0, 8)}...]` : ''}`, transactionId, details);
  }

  /**
   * Log DEX swap operation
   */
  dexOperation(transactionId: string, action: string, amount: string, token: string, txHash?: string): void {
    this.info('DEX', `${action}: ${amount} ${token}${txHash ? ` → ${maskWalletAddress(txHash)}` : ''}`, transactionId, { amount, token });
  }

  /**
   * Log user-friendly error with actionable message
   */
  userError(transactionId: string | undefined, code: string, message: string, technicalDetails?: string): void {
    this.error('PAYMENT', `Error [${code}]: ${message}`, transactionId, technicalDetails ? { technical: technicalDetails } : undefined);
  }

  /**
   * Structured audit event — immutable record of a significant pipeline event.
   * All fields are sanitized. Suitable for compliance and reconciliation.
   */
  auditEvent(
    transactionId: string,
    event: string,
    phase: 'INITIATION' | 'BLOCKCHAIN' | 'DEX_SWAP' | 'OFFRAMP' | 'MPESA' | 'SETTLEMENT' | 'REFUND' | 'FAILURE',
    details: Record<string, unknown>
  ): void {
    this.info('RECONCILIATION', `[AUDIT] ${event}`, transactionId, {
      phase,
      event,
      ...details,
    });
  }

  /**
   * Log refund initiation
   */
  refundInitiated(transactionId: string, walletAddress: string, wldAmount: string, reason: string): void {
    this.info('REFUND', `Refund initiated: ${wldAmount} WLD → ${maskWalletAddress(walletAddress)}`, transactionId, {
      wldAmount,
      wallet: maskWalletAddress(walletAddress),
      reason,
      refundStatus: 'REFUND_INITIATED',
    });
  }

  /**
   * Log successful refund completion
   */
  refundCompleted(transactionId: string, walletAddress: string, wldAmount: string, refundTxHash?: string): void {
    this.info('REFUND', `Refund completed: ${wldAmount} WLD returned`, transactionId, {
      wldAmount,
      wallet: maskWalletAddress(walletAddress),
      refundTxHash: refundTxHash ? `${refundTxHash.slice(0, 10)}...${refundTxHash.slice(-6)}` : 'N/A',
      refundStatus: 'REFUNDED',
    });
  }

  /**
   * Log refund failure — requires manual intervention
   */
  refundFailed(transactionId: string, walletAddress: string, wldAmount: string, reason: string): void {
    this.error('REFUND', `Refund FAILED — manual intervention required: ${wldAmount} WLD`, transactionId, {
      wallet: maskWalletAddress(walletAddress),
      wldAmount,
      reason,
      refundStatus: 'REFUND_FAILED',
      escalation: 'MANUAL_REVIEW',
    });
  }

  /**
   * Log reconciliation alert — discrepancy between expected and actual state
   */
  reconciliationAlert(transactionId: string, field: string, expected: unknown, actual: unknown): void {
    this.warn('RECONCILIATION', `State discrepancy detected: ${field}`, transactionId, {
      field,
      expected,
      actual,
      action: 'INVESTIGATE',
    });
  }

  /**
   * Log security event (unauthorized access, suspicious pattern)
   */
  securityEvent(event: string, details: Record<string, unknown>): void {
    this.warn('SECURITY', `[SECURITY] ${event}`, undefined, details);
  }

  /**
   * Print a startup banner summarising system configuration.
   * Call once from server.ts after env validation.
   */
  startupBanner(mode: string, hasAdminKey: boolean, hasBitnob: boolean, hasMpesa: boolean): void {
    const ok  = '\x1b[32m✓\x1b[0m';
    const bad = '\x1b[31m✗\x1b[0m';
    const warn = '\x1b[33m~\x1b[0m';
    console.log('\n\x1b[1m\x1b[36m┌──────────────────────────────────────────────┐');
    console.log(`│  WLD2Mpesa  — ${mode.padEnd(30)}│`);
    console.log('└──────────────────────────────────────────────┘\x1b[0m');
    console.log(`  ${hasAdminKey ? ok : bad} ADMIN_PRIVATE_KEY   ${hasAdminKey ? '\x1b[32mset (refunds enabled)\x1b[0m' : '\x1b[31mMISSING — on-chain refunds disabled\x1b[0m'}`);
    console.log(`  ${hasBitnob  ? ok : warn} Bitnob credentials  ${hasBitnob  ? '\x1b[32mset\x1b[0m' : '\x1b[33mpartially missing — KES payout may fail\x1b[0m'}`);
    console.log(`  ${hasMpesa   ? ok : warn} M-Pesa credentials  ${hasMpesa   ? '\x1b[32mset\x1b[0m' : '\x1b[33mmissing — webhook callbacks inactive\x1b[0m'}`);
    console.log('');
  }

  /**
   * Divider line — visually separates pipeline runs in console output.
   */
  pipelineDivider(transactionId: string, action: 'START' | 'END' | 'RETRY'): void {
    const colors: Record<string, string> = {
      START: '\x1b[36m', END: '\x1b[32m', RETRY: '\x1b[33m',
    };
    const icons: Record<string, string> = { START: '▶', END: '■', RETRY: '↩' };
    const c = colors[action] ?? '';
    console.log(`${c}${'─'.repeat(60)}\x1b[0m`);
    console.log(`${c}  ${icons[action]} PIPELINE ${action}: ${transactionId}\x1b[0m`);
    console.log(`${c}${'─'.repeat(60)}\x1b[0m`);
  }
}

export const logger = new Logger();
