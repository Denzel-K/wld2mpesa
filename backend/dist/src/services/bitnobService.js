"use strict";
/**
 * bitnobService.ts — Bitnob Payouts API v2 Integration
 *
 * Implements the current 3-step Bitnob Payouts API:
 *   Step 1: POST /api/payouts/quotes         — Lock a conversion quote
 *   Step 2: POST /api/payouts/:id/initialize — Attach beneficiary details
 *   Step 3: POST /api/payouts/:id/finalize   — Execute the payout
 *
 * Authentication: HMAC-SHA256 per request
 *   Headers: X-Auth-Client, X-Auth-Timestamp, X-Auth-Nonce, X-Auth-Signature
 *   Signature = HMAC_SHA256(SECRET, "CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD")
 *
 * Base URL (both sandbox and production):
 *   https://api.bitnob.com
 *   Environment is determined by the API key pair used, not the URL.
 *
 * Kenya (KES) Corridor specifics:
 *   - send / pochi  → mobile_money  (M-Pesa phone number, international format)
 *   - till          → mobile_money  (buy_goods channel, till_number field)
 *   - paybill       → mobile_money  (paybill channel, paybill_number + account_number)
 *
 * @see https://docs.bitnob.com/docs/payouts
 * @see https://docs.bitnob.com/docs/payouts/corridor-specific-behavior/kenya-payout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bitnobService = exports.BitnobService = void 0;
exports.createBitnobService = createBitnobService;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const prisma_1 = require("../db/prisma");
const logger_1 = require("../utils/logger");
// ─── Constants ────────────────────────────────────────────────────────────────
const BITNOB_BASE_URL = 'https://api.bitnob.com';
// Quote TTL: Bitnob locks rates for ~60 s; we cache for 50 s to be safe.
const QUOTE_TTL_MS = 50000;
const quoteCache = new Map();
// ─── BitnobService ────────────────────────────────────────────────────────────
class BitnobService {
    // ── Auth helpers ────────────────────────────────────────────────────────────
    /**
     * Generate HMAC-SHA256 request signature.
     *
     * Signature string: "CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD"
     * where PAYLOAD is the exact JSON body string (empty string for GET).
     */
    buildAuthHeaders(payload) {
        const clientId = config_1.config.BITNOB_CLIENT_ID;
        const secret = config_1.config.BITNOB_SECRET_KEY;
        if (!clientId || !secret) {
            throw new Error('BITNOB_CLIENT_ID and BITNOB_SECRET_KEY must both be set. ' +
                'Retrieve them from the Bitnob dashboard → Developer → API Keys.');
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto_1.default.randomBytes(16).toString('hex');
        const message = `${clientId}:${timestamp}:${nonce}:${payload}`;
        const signature = crypto_1.default.createHmac('sha256', secret).update(message).digest('hex');
        return {
            'X-Auth-Client': clientId,
            'X-Auth-Timestamp': timestamp,
            'X-Auth-Nonce': nonce,
            'X-Auth-Signature': signature,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }
    /** Shared fetch with HMAC signing and structured error handling */
    async bitnobFetch(endpoint, method, body, reference) {
        const payload = body ? JSON.stringify(body) : '';
        const headers = this.buildAuthHeaders(payload);
        const url = `${BITNOB_BASE_URL}${endpoint}`;
        const response = await fetch(url, {
            method,
            headers,
            body: payload || undefined,
        });
        const data = await response.json();
        if (!response.ok) {
            const msg = data?.message ||
                data?.error ||
                data?.detail ||
                `HTTP ${response.status} ${response.statusText}`;
            logger_1.logger.error('BITNOB', `API error on ${method} ${endpoint}`, reference, {
                status: response.status,
                message: msg,
            });
            throw new Error(`Bitnob API Error [${response.status}]: ${msg}`);
        }
        return (data.data ?? data);
    }
    // ── Phone number helpers ─────────────────────────────────────────────────────
    /**
     * Normalise a Kenyan phone number to international format (+254XXXXXXXXX).
     * Accepts: 0712345678, 254712345678, +254712345678
     */
    normaliseKenyaPhone(raw) {
        const clean = raw.replace(/\s+/g, '').replace(/^\\+/, '').replace(/^\+/, '');
        if (clean.startsWith('254'))
            return `+${clean}`;
        if (clean.startsWith('0'))
            return `+254${clean.slice(1)}`;
        // Bare 9-digit number
        return `+254${clean}`;
    }
    /** Validate a normalised Kenyan M-Pesa phone number */
    validateKenyaPhone(normalised) {
        // Safaricom: +2547XXXXXXXX  | Airtel: +2541XXXXXXXX
        if (!/^\+254[17]\d{8}$/.test(normalised)) {
            throw new Error(`Invalid Kenyan phone number "${normalised}". ` +
                'Expected Safaricom (+2547XXXXXXXX) or Airtel (+2541XXXXXXXX).');
        }
    }
    // ── Step 1: Create Quote ────────────────────────────────────────────────────
    /**
     * Request a locked conversion quote from Bitnob.
     * Quotes expire in ~60 s; we cache per txnId to handle retries gracefully.
     *
     * @param kesAmount  - Settlement amount in KES (what the recipient receives)
     * @param reference  - Our transaction ID (used as idempotency key)
     */
    async createQuote(kesAmount, reference) {
        // Return cached quote if still valid
        const cached = quoteCache.get(reference);
        if (cached && cached.expiresAt > Date.now()) {
            logger_1.logger.debug('BITNOB', `Using cached quote [${cached.quoteId.slice(0, 8)}...]`, reference);
            // Re-fetch status in case it changed
            return this.bitnobFetch(`/api/payouts/${cached.quoteId}`, 'GET', undefined, reference);
        }
        const requestBody = {
            from_asset: 'USDC',
            to_currency: 'KES',
            settlement_amount: kesAmount.toFixed(2),
            country: 'KE',
            source: 'offchain',
            reference,
        };
        logger_1.logger.bitnobOperation(reference, 'Creating payout quote', undefined, {
            kesAmount: (0, logger_1.formatAmount)(kesAmount),
            asset: 'USDC',
        });
        const quote = await this.bitnobFetch('/api/payouts/quotes', 'POST', requestBody, reference);
        // Cache it
        quoteCache.set(reference, {
            quoteId: quote.id,
            expiresAt: Date.now() + QUOTE_TTL_MS,
        });
        logger_1.logger.bitnobOperation(reference, `Quote created [${quote.id.slice(0, 8)}...]`, quote.id, {
            fromAmount: `${quote.from_amount} USDC`,
            toAmount: `${quote.settlement_amount} KES`,
            exchangeRate: `1 USDC = ${quote.exchange_rate} KES`,
            fee: `${quote.fee} USDC`,
            expiresAt: quote.expires_at,
        });
        return quote;
    }
    // ── Step 2: Initialize Payout ───────────────────────────────────────────────
    /**
     * Attach beneficiary details to a quote.
     *
     * Kenya corridor beneficiary rules:
     *   send / pochi → mobile_money  (phone number, no channel field)
     *   till         → mobile_money  (channel: buy_goods, till_number)
     *   paybill      → mobile_money  (channel: paybill, paybill_number, account_number)
     */
    async initializeQuote(quoteId, phoneNumber, payoutType, options, reference) {
        let beneficiary;
        switch (payoutType) {
            case 'send':
            case 'pochi': {
                if (!phoneNumber)
                    throw new Error('Phone number is required for send/pochi payouts.');
                const normalised = this.normaliseKenyaPhone(phoneNumber);
                this.validateKenyaPhone(normalised);
                beneficiary = {
                    type: 'mobile_money',
                    phone_number: normalised,
                    network: 'mpesa',
                    country: 'KE',
                    ...(options.recipientName && { name: options.recipientName }),
                };
                break;
            }
            case 'till': {
                const till = options.tillNumber;
                if (!till)
                    throw new Error('Till number is required for till payouts.');
                if (!/^\d{5,6}$/.test(till)) {
                    throw new Error(`Invalid Till number "${till}". Must be 5 or 6 digits.`);
                }
                beneficiary = {
                    type: 'mobile_money',
                    channel: 'buy_goods',
                    till_number: till,
                    country: 'KE',
                    ...(options.recipientName && { name: options.recipientName }),
                };
                break;
            }
            case 'paybill': {
                const paybill = options.paybillNumber;
                const account = options.accountNumber;
                if (!paybill)
                    throw new Error('Paybill number is required for paybill payouts.');
                if (!account)
                    throw new Error('Account number is required for paybill payouts.');
                if (!/^\d{5,7}$/.test(paybill)) {
                    throw new Error(`Invalid Paybill number "${paybill}". Must be 5–7 digits.`);
                }
                beneficiary = {
                    type: 'mobile_money',
                    channel: 'paybill',
                    paybill_number: paybill,
                    account_number: account,
                    country: 'KE',
                    ...(options.recipientName && { name: options.recipientName }),
                };
                break;
            }
            default:
                throw new Error(`Unsupported payout type: ${payoutType}`);
        }
        const requestBody = {
            beneficiary,
            customer_email: 'customer@wld2mpesa.app',
            metadata: { txnId: reference, app: 'wld2mpesa' },
        };
        logger_1.logger.bitnobOperation(reference, `Initializing payout [${quoteId.slice(0, 8)}...]`, quoteId, {
            type: payoutType,
            beneficiary: this.describeBeneficiary(beneficiary),
        });
        await this.bitnobFetch(`/api/payouts/${quoteId}/initialize`, 'POST', requestBody, reference);
        logger_1.logger.bitnobOperation(reference, '✓ Payout initialized', quoteId);
    }
    // ── Step 3: Finalize Payout ─────────────────────────────────────────────────
    /**
     * Finalize the payout. After this call, Bitnob begins settlement.
     * The payout ID returned here is what we poll / receive webhooks for.
     */
    async finalizePayout(quoteId, reference) {
        logger_1.logger.bitnobOperation(reference, `Finalizing payout [${quoteId.slice(0, 8)}...]`, quoteId);
        const result = await this.bitnobFetch(`/api/payouts/${quoteId}/finalize`, 'POST', {}, reference);
        logger_1.logger.bitnobOperation(reference, `✓ Payout finalized — status: ${result.status}`, quoteId, {
            status: result.status,
            settlement: `${result.settlement_amount} KES`,
        });
        return result;
    }
    // ── Full 3-Step Orchestration ───────────────────────────────────────────────
    /**
     * Execute the complete Quote → Initialize → Finalize flow for a payout.
     *
     * @param kesAmount   - KES amount recipient should receive (post-fee)
     * @param phoneNumber - Required for send/pochi; null for till/paybill
     * @param reference   - Our transaction ID (idempotency key)
     * @param payoutType  - 'send' | 'pochi' | 'till' | 'paybill'
     * @param options     - tillNumber, paybillNumber, accountNumber, recipientName
     */
    async initiatePayout(kesAmount, phoneNumber, reference, payoutType = 'send', options = {}) {
        const label = this.payoutTypeLabel(payoutType);
        logger_1.logger.bitnobOperation(reference, `Initiating ${label} payout`, undefined, {
            amount: (0, logger_1.formatAmount)(kesAmount),
            type: payoutType,
            environment: config_1.config.BITNOB_ENV,
        });
        // Preflight: ensure Bitnob wallet has enough USDC
        await this.ensureSufficientBalance(kesAmount, reference);
        // Step 1 — Quote
        const quote = await this.createQuote(kesAmount, reference);
        // Step 2 — Initialize
        await this.initializeQuote(quote.id, phoneNumber, payoutType, options, reference);
        // Step 3 — Finalize
        const payout = await this.finalizePayout(quote.id, reference);
        return payout;
    }
    // ── Status Polling ──────────────────────────────────────────────────────────
    /**
     * Fetch the current status of a payout by its ID (quoteId / payoutId).
     *
     * Endpoint: GET /api/payouts/:id
     */
    async getPayoutStatus(payoutId, reference) {
        logger_1.logger.bitnobOperation(reference ?? 'unknown', 'Polling payout status', payoutId);
        const status = await this.bitnobFetch(`/api/payouts/${payoutId}`, 'GET', undefined, reference);
        logger_1.logger.debug('BITNOB', `Status: ${status.status}`, reference ?? 'unknown', {
            payoutId,
            status: status.status,
            settlement: `${status.settlement_amount} KES`,
        });
        return status;
    }
    // ── Balance Check ───────────────────────────────────────────────────────────
    /**
     * Fetch USDC wallet balance from Bitnob and verify it covers the payout.
     * Uses the live exchange rate returned by the quote endpoint to avoid
     * the previously hardcoded 130 KES/USD stub.
     */
    async ensureSufficientBalance(kesAmount, reference) {
        try {
            const balances = await this.getWalletBalance();
            // Get a live rate estimate: 1 USDC ≈ how much KES?
            const rate = await this.getLiveUsdcKesRate();
            // Add 5% buffer for rate slippage
            const requiredUsdc = (kesAmount / rate) * 1.05;
            logger_1.logger.info('BITNOB', 'Balance pre-flight check', reference, {
                requiredUsdc: requiredUsdc.toFixed(4),
                availableUsdc: balances.usdc.toFixed(4),
                rate: `1 USDC = ${rate.toFixed(2)} KES`,
                bufferApplied: '5%',
            });
            if (balances.usdc >= requiredUsdc)
                return true;
            throw new Error(`Insufficient Bitnob balance. ` +
                `Need ~${requiredUsdc.toFixed(2)} USDC, have ${balances.usdc.toFixed(2)} USDC. ` +
                `Please top up the Bitnob wallet.`);
        }
        catch (err) {
            if (err instanceof Error && err.message.startsWith('Insufficient')) {
                throw err; // Propagate balance errors
            }
            // Connectivity/auth errors on balance check: fail open but log loudly
            logger_1.logger.warn('BITNOB', 'Balance check failed — proceeding (fail-open)', reference, err);
            return true;
        }
    }
    /** Fetch all wallet balances */
    async getWalletBalance() {
        try {
            const data = await this.bitnobFetch('/api/wallets/balances', 'GET');
            const balances = data.balances ?? data;
            return {
                usdc: parseFloat(balances.usdc ?? balances.USDC ?? 0),
                kes: parseFloat(balances.kes ?? balances.KES ?? 0),
                btc: parseFloat(balances.btc ?? balances.BTC ?? 0),
            };
        }
        catch (error) {
            logger_1.logger.error('BITNOB', 'Failed to fetch wallet balance', undefined, error);
            return { usdc: 0, kes: 0, btc: 0 };
        }
    }
    // ── Exchange Rate ───────────────────────────────────────────────────────────
    /**
     * Fetch live USDC → KES rate from the Bitnob rates endpoint.
     * Falls back to a conservative 130 KES/USDC only if the API is unreachable.
     */
    async getLiveUsdcKesRate() {
        try {
            const data = await this.bitnobFetch('/api/rates?from=USDC&to=KES&country=KE', 'GET');
            const rate = parseFloat(data?.rate ?? data?.exchange_rate ?? 0);
            if (rate > 0) {
                logger_1.logger.debug('BITNOB', `Live rate: 1 USDC = ${rate} KES`);
                return rate;
            }
            throw new Error('Rate response missing or zero');
        }
        catch {
            logger_1.logger.warn('BITNOB', 'Live rate fetch failed — using conservative fallback 128 KES/USDC');
            return 128; // Conservative fallback (slightly below market to not over-commit)
        }
    }
    /**
     * Generic exchange rate helper (used by external callers / admin panel)
     */
    async getExchangeRate(fromCurrency, toCurrency) {
        logger_1.logger.debug('BITNOB', `Fetching rate: ${fromCurrency} → ${toCurrency}`);
        try {
            const data = await this.bitnobFetch(`/api/rates?from=${fromCurrency}&to=${toCurrency}`, 'GET');
            const rate = parseFloat(data?.rate ?? data?.exchange_rate ?? 0);
            logger_1.logger.debug('BITNOB', `Rate: 1 ${fromCurrency} = ${rate} ${toCurrency}`);
            return rate;
        }
        catch (err) {
            logger_1.logger.error('BITNOB', 'Exchange rate fetch failed', undefined, err);
            throw err;
        }
    }
    // ── IOfframpService implementation ─────────────────────────────────────────
    /**
     * Called by the payment pipeline: orchestrates the full payout for a txnId.
     */
    async initiateSwap(wldAmount, kesAmount, txnId) {
        logger_1.logger.pipelineStep(txnId, 3, 4, `Off-ramp: ${(0, logger_1.formatAmount)(kesAmount)} KES → Bitnob`);
        // Load transaction from store to determine payout type and recipient details
        const payment = await prisma_1.prisma.transaction.findUnique({ where: { id: txnId } });
        if (!payment) {
            throw new Error(`Transaction ${txnId} not found in database`);
        }
        logger_1.logger.info('PAYMENT', `Processing ${(0, logger_1.formatTransactionType)(payment.transactionType)} payout`, txnId, {
            type: payment.transactionType,
            kesAmount: (0, logger_1.formatAmount)(kesAmount),
            wldAmount: `${wldAmount} WLD`,
        });
        // Resolve payout arguments from the stored transaction
        const { phoneNumber, payoutType, options } = this.resolvePayoutArgs(payment);
        // Execute the full 3-step flow
        const payout = await this.initiatePayout(kesAmount, phoneNumber, txnId, payoutType, options);
        logger_1.logger.pipelineStep(txnId, 3, 4, `✓ Payout finalized [${payout.id.slice(0, 8)}...]`);
        return {
            swapId: payout.id,
            status: this.mapStatus(payout.status),
            estimatedKes: parseFloat(payout.settlement_amount),
        };
    }
    /**
     * Poll status of a running payout.
     */
    async checkSwapStatus(swapId, reference) {
        try {
            const payout = await this.getPayoutStatus(swapId, reference);
            const status = this.mapStatus(payout.status);
            if (status === 'COMPLETED') {
                logger_1.logger.pipelineStep(reference ?? 'unknown', 4, 4, '✓ Bitnob payout settled on M-Pesa');
            }
            else if (status === 'FAILED') {
                logger_1.logger.error('BITNOB', `Payout failed: ${payout.failure_reason ?? 'Unknown'}`, reference, {
                    payoutId: swapId,
                });
            }
            return status;
        }
        catch (err) {
            logger_1.logger.error('BITNOB', 'Status check failed', reference, err);
            return 'PENDING'; // Assume still in-flight on transient error
        }
    }
    // ── Validation Helpers ──────────────────────────────────────────────────────
    /**
     * Validate a phone number for a given country.
     * Returns normalized number and detected network.
     */
    async validatePhoneNumber(phoneNumber, country) {
        const patterns = {
            Kenya: { pattern: /^\+254[17]\d{8}$/, prefix: '254' },
            Ghana: { pattern: /^\+233[235]\d{8}$/, prefix: '233' },
            Uganda: { pattern: /^\+256[79]\d{8}$/, prefix: '256' },
            Nigeria: { pattern: /^\+234[789]\d{9}$/, prefix: '234' },
            Rwanda: { pattern: /^\+250[78]\d{8}$/, prefix: '250' },
            Mali: { pattern: /^\+223[4678]\d{7}$/, prefix: '223' },
            'Burkina Faso': { pattern: /^\+226[567]\d{7}$/, prefix: '226' },
            Benin: { pattern: /^\+229[4569]\d{7}$/, prefix: '229' },
            Cameroon: { pattern: /^\+237[6789]\d{7}$/, prefix: '237' },
            'Ivory Coast': { pattern: /^\+225[45789]\d{7}$/, prefix: '225' },
            Senegal: { pattern: /^\+221[76]\d{7}$/, prefix: '221' },
            Togo: { pattern: /^\+228[79]\d{7}$/, prefix: '228' },
            'Guinea Conakry': { pattern: /^\+224[6]\d{7}$/, prefix: '224' },
        };
        const { pattern, prefix } = patterns[country] ?? {};
        if (!pattern)
            return { valid: false };
        let normalised = phoneNumber.replace(/\s+/g, '').replace(/^\+/, '');
        if (!normalised.startsWith(prefix)) {
            normalised = prefix + normalised.replace(/^0/, '');
        }
        normalised = '+' + normalised;
        const valid = pattern.test(normalised);
        return { valid, formattedNumber: normalised };
    }
    /** Fetch list of supported payout countries */
    async getSupportedCountries() {
        try {
            const data = await this.bitnobFetch('/api/payouts/supported-countries', 'GET');
            return (data.countries ?? data);
        }
        catch (err) {
            logger_1.logger.error('BITNOB', 'Failed to fetch supported countries', undefined, err);
            return [];
        }
    }
    // ── Private Utilities ───────────────────────────────────────────────────────
    /**
     * Extract phone number, payout type, and options from a stored transaction.
     */
    resolvePayoutArgs(payment) {
        const type = payment.transactionType;
        switch (type) {
            case 'send':
            case 'pochi':
                if (!payment.phoneNumber) {
                    throw new Error(`Phone number missing for ${type} payout [${payment.id}]`);
                }
                return {
                    phoneNumber: payment.phoneNumber,
                    payoutType: type,
                    options: {},
                };
            case 'till':
                if (!payment.tillNumber) {
                    throw new Error(`Till number missing for till payout [${payment.id}]`);
                }
                return {
                    phoneNumber: null,
                    payoutType: 'till',
                    options: { tillNumber: payment.tillNumber },
                };
            case 'paybill':
                if (!payment.tillNumber) {
                    throw new Error(`Paybill number missing for paybill payout [${payment.id}]`);
                }
                if (!payment.accountNumber) {
                    throw new Error(`Account number missing for paybill payout [${payment.id}]`);
                }
                return {
                    phoneNumber: null,
                    payoutType: 'paybill',
                    options: {
                        paybillNumber: payment.tillNumber,
                        accountNumber: payment.accountNumber,
                    },
                };
            default:
                throw new Error(`Unsupported transaction type: ${type}`);
        }
    }
    /**
     * Map Bitnob v2 status strings to our internal SwapStatus.
     *
     * Bitnob v2 lifecycle:
     *   pending → initialized → finalized → processing → success | failed | reversed
     */
    mapStatus(bitnobStatus) {
        const s = bitnobStatus.toLowerCase();
        if (s === 'success' || s === 'completed' || s === 'successful')
            return 'COMPLETED';
        if (s === 'failed' || s === 'rejected' || s === 'reversed')
            return 'FAILED';
        // pending, initialized, finalized, processing → still in-flight
        return 'PENDING';
    }
    /** Human-readable label for logging */
    payoutTypeLabel(type) {
        const map = {
            send: 'Send Money',
            pochi: 'Pochi la Biashara',
            till: 'Buy Goods (Till)',
            paybill: 'Paybill',
        };
        return map[type] ?? type;
    }
    /** Safe redacted description of a beneficiary for logs */
    describeBeneficiary(b) {
        if ('phone_number' in b)
            return `M-Pesa ${(0, logger_1.maskPhoneNumber)(b.phone_number)}`;
        if ('till_number' in b)
            return `Till ${b.till_number}`;
        if ('paybill_number' in b)
            return `Paybill ${b.paybill_number} / Acct ${b.account_number?.slice(0, 3)}...`;
        return 'Unknown';
    }
}
exports.BitnobService = BitnobService;
// ─── Exports ──────────────────────────────────────────────────────────────────
exports.bitnobService = new BitnobService();
function createBitnobService() {
    return new BitnobService();
}
//# sourceMappingURL=bitnobService.js.map