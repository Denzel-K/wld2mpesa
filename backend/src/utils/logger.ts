/**
 * logger.ts — Structured logging utility
 *
 * Provides consistent, safe logging across the application.
 * Masks sensitive data (phone numbers, API keys) and categorizes logs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'PAYMENT' | 'PIPELINE' | 'BITNOB' | 'BLOCKCHAIN' | 'DEX' | 'WEBHOOK' | 'API' | 'DATABASE';

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

    // In production, you might want to send this to a logging service
    const prefix = `[${entry.timestamp}] [${category}]${transactionId ? ` [${transactionId}]` : ''}`;
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    if (metadata && Object.keys(metadata).length > 0) {
      logFn(`${prefix} ${message}`, metadata);
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
    this.info('PIPELINE', `Step ${step}/${totalSteps}: ${description}`, transactionId, { step, totalSteps });
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
}

export const logger = new Logger();
