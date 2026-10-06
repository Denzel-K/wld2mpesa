"use strict";
/**
 * logger.ts — Structured logging utility
 *
 * Provides consistent, safe logging across the application.
 * Masks sensitive data (phone numbers, API keys) and categorizes logs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.maskPhoneNumber = maskPhoneNumber;
exports.maskWalletAddress = maskWalletAddress;
exports.maskApiKey = maskApiKey;
exports.formatTransactionType = formatTransactionType;
exports.formatAmount = formatAmount;
/**
 * Mask sensitive phone numbers - show only last 4 digits
 * Example: 254712345678 → 2547••••5678
 */
function maskPhoneNumber(phone) {
    if (!phone)
        return 'N/A';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4)
        return '•'.repeat(clean.length);
    return clean.slice(0, 4) + '•'.repeat(clean.length - 8) + clean.slice(-4);
}
/**
 * Mask wallet address - show first 6 and last 4 characters
 * Example: 0x1234567890abcdef... → 0x1234...cdef
 */
function maskWalletAddress(address) {
    if (!address)
        return 'N/A';
    if (address.length < 10)
        return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
/**
 * Mask API key - show only first 8 and last 4 characters
 */
function maskApiKey(key) {
    if (!key)
        return 'N/A';
    if (key.length < 12)
        return '•'.repeat(key.length);
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
/**
 * Format transaction type for display
 */
function formatTransactionType(type) {
    const types = {
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
function formatAmount(amount, currency = 'KES') {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num))
        return `0 ${currency}`;
    return `${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;
}
class Logger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
    }
    log(level, category, message, transactionId, metadata) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            transactionId,
            metadata: this.sanitizeMetadata(metadata),
        };
        const LEVEL_PREFIX = {
            debug: '\x1b[2m[DBG]\x1b[0m',
            info: '\x1b[36m[INF]\x1b[0m',
            warn: '\x1b[33m[WRN]\x1b[0m',
            error: '\x1b[31m[ERR]\x1b[0m',
        };
        const CAT_COLOR = {
            REFUND: '\x1b[33m',
            RECONCILIATION: '\x1b[35m',
            PIPELINE: '\x1b[36m',
            BLOCKCHAIN: '\x1b[34m',
            DEX: '\x1b[34m',
            SECURITY: '\x1b[31m',
            PAYMENT: '\x1b[32m',
        };
        const catColor = CAT_COLOR[category] ?? '';
        const reset = '\x1b[0m';
        const prefix = `${LEVEL_PREFIX[level]} ${catColor}[${category}]${reset}${transactionId ? ` \x1b[2m[${transactionId.slice(-12)}]\x1b[0m` : ''}`;
        const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        if (metadata && Object.keys(metadata).length > 0) {
            logFn(`${prefix} ${message}`, entry.metadata);
        }
        else {
            logFn(`${prefix} ${message}`);
        }
    }
    /**
     * Remove sensitive data from metadata
     */
    sanitizeMetadata(metadata) {
        if (!metadata)
            return undefined;
        const sanitized = {};
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
    debug(category, message, transactionId, metadata) {
        if (this.isDevelopment) {
            this.log('debug', category, message, transactionId, metadata);
        }
    }
    info(category, message, transactionId, metadata) {
        this.log('info', category, message, transactionId, metadata);
    }
    warn(category, message, transactionId, metadata) {
        this.log('warn', category, message, transactionId, metadata);
    }
    error(category, message, transactionId, error) {
        const metadata = error instanceof Error
            ? { error: error.message, stack: this.isDevelopment ? error.stack : undefined }
            : { error };
        this.log('error', category, message, transactionId, metadata);
    }
    // ─── Payment Pipeline Specific Methods ────────────────────────────────────
    /**
     * Log payment initiation with masked sensitive data
     */
    paymentInitiated(transactionId, type, amount, recipient) {
        this.info('PAYMENT', `Payment initiated: ${formatTransactionType(type)} ${formatAmount(amount)}`, transactionId, {
            type,
            amount,
            recipient: maskPhoneNumber(recipient),
        });
    }
    /**
     * Log pipeline step progress
     */
    pipelineStep(transactionId, step, totalSteps, description) {
        const bar = Array.from({ length: totalSteps }, (_, i) => i < step ? '█' : '░').join('');
        this.info('PIPELINE', `[${bar}] ${step}/${totalSteps} ${description}`, transactionId);
    }
    /**
     * Log blockchain transaction
     */
    blockchainTx(transactionId, action, txHash, details) {
        this.info('BLOCKCHAIN', `${action}${txHash ? ` (${maskWalletAddress(txHash)})` : ''}`, transactionId, details);
    }
    /**
     * Log Bitnob operation
     */
    bitnobOperation(transactionId, operation, payoutId, details) {
        this.info('BITNOB', `${operation}${payoutId ? ` [${payoutId.slice(0, 8)}...]` : ''}`, transactionId, details);
    }
    /**
     * Log DEX swap operation
     */
    dexOperation(transactionId, action, amount, token, txHash) {
        this.info('DEX', `${action}: ${amount} ${token}${txHash ? ` → ${maskWalletAddress(txHash)}` : ''}`, transactionId, { amount, token });
    }
    /**
     * Log user-friendly error with actionable message
     */
    userError(transactionId, code, message, technicalDetails) {
        this.error('PAYMENT', `Error [${code}]: ${message}`, transactionId, technicalDetails ? { technical: technicalDetails } : undefined);
    }
    /**
     * Structured audit event — immutable record of a significant pipeline event.
     * All fields are sanitized. Suitable for compliance and reconciliation.
     */
    auditEvent(transactionId, event, phase, details) {
        this.info('RECONCILIATION', `[AUDIT] ${event}`, transactionId, {
            phase,
            event,
            ...details,
        });
    }
    /**
     * Log refund initiation
     */
    refundInitiated(transactionId, walletAddress, wldAmount, reason) {
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
    refundCompleted(transactionId, walletAddress, wldAmount, refundTxHash) {
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
    refundFailed(transactionId, walletAddress, wldAmount, reason) {
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
    reconciliationAlert(transactionId, field, expected, actual) {
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
    securityEvent(event, details) {
        this.warn('SECURITY', `[SECURITY] ${event}`, undefined, details);
    }
    /**
     * Print a startup banner summarising system configuration.
     * Call once from server.ts after env validation.
     */
    startupBanner(mode, hasAdminKey, hasBitnob, hasMpesa) {
        const ok = '\x1b[32m✓\x1b[0m';
        const bad = '\x1b[31m✗\x1b[0m';
        const warn = '\x1b[33m~\x1b[0m';
        console.log('\n\x1b[1m\x1b[36m┌──────────────────────────────────────────────┐');
        console.log(`│  WLD2Mpesa  — ${mode.padEnd(30)}│`);
        console.log('└──────────────────────────────────────────────┘\x1b[0m');
        console.log(`  ${hasAdminKey ? ok : bad} ADMIN_PRIVATE_KEY   ${hasAdminKey ? '\x1b[32mset (refunds enabled)\x1b[0m' : '\x1b[31mMISSING — on-chain refunds disabled\x1b[0m'}`);
        console.log(`  ${hasBitnob ? ok : warn} Bitnob credentials  ${hasBitnob ? '\x1b[32mset\x1b[0m' : '\x1b[33mpartially missing — KES payout may fail\x1b[0m'}`);
        console.log(`  ${hasMpesa ? ok : warn} M-Pesa credentials  ${hasMpesa ? '\x1b[32mset\x1b[0m' : '\x1b[33mmissing — webhook callbacks inactive\x1b[0m'}`);
        console.log('');
    }
    /**
     * Divider line — visually separates pipeline runs in console output.
     */
    pipelineDivider(transactionId, action) {
        const colors = {
            START: '\x1b[36m', END: '\x1b[32m', RETRY: '\x1b[33m',
        };
        const icons = { START: '▶', END: '■', RETRY: '↩' };
        const c = colors[action] ?? '';
        console.log(`${c}${'─'.repeat(60)}\x1b[0m`);
        console.log(`${c}  ${icons[action]} PIPELINE ${action}: ${transactionId}\x1b[0m`);
        console.log(`${c}${'─'.repeat(60)}\x1b[0m`);
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map