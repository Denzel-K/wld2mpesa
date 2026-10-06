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
import type { IOfframpService, SwapResult, SwapStatus } from '../types';
export type BitnobCountry = 'Kenya' | 'Ghana' | 'Uganda' | 'Nigeria' | 'Rwanda' | 'Mali' | 'Burkina Faso' | 'Benin' | 'Cameroon' | 'Ivory Coast' | 'Senegal' | 'Togo' | 'Guinea Conakry';
export type BitnobCountryCode = 'KE' | 'GH' | 'UG' | 'NG' | 'RW' | 'ML' | 'BF' | 'BJ' | 'CM' | 'CI' | 'SN' | 'TG' | 'GN';
export type MobileNetwork = 'mpesa' | 'mtn' | 'vodafone' | 'airtel' | 'orange' | 'wave';
/**
 * Kenya-specific payout channel.
 * - mobile_money : send to M-Pesa number (send / pochi)
 * - buy_goods    : pay to M-Pesa Till / Buy-Goods number
 * - paybill      : pay to M-Pesa Paybill number + account
 */
export type KenyaPayoutChannel = 'mobile_money' | 'buy_goods' | 'paybill';
/** Quote request — Step 1 */
export interface BitnobQuoteRequest {
    from_asset: string;
    to_currency: string;
    settlement_amount: string;
    country: BitnobCountryCode;
    source: 'offchain';
    reference: string;
}
/** Quote response — Step 1 */
export interface BitnobQuoteResponse {
    id: string;
    from_asset: string;
    to_currency: string;
    from_amount: string;
    settlement_amount: string;
    exchange_rate: string;
    fee: string;
    expires_at: string;
    reference: string;
    status: 'pending' | 'initialized' | 'finalized' | 'success' | 'failed';
}
/** Beneficiary for Kenya mobile_money (send / pochi) — Step 2 */
export interface KenyaMobileMoneyBeneficiary {
    type: 'mobile_money';
    phone_number: string;
    network: 'mpesa';
    country: 'KE';
    name?: string;
}
/** Beneficiary for Kenya buy_goods (Till) — Step 2 */
export interface KenyaBuyGoodsBeneficiary {
    type: 'mobile_money';
    channel: 'buy_goods';
    till_number: string;
    country: 'KE';
    name?: string;
}
/** Beneficiary for Kenya paybill — Step 2 */
export interface KenyaPaybillBeneficiary {
    type: 'mobile_money';
    channel: 'paybill';
    paybill_number: string;
    account_number: string;
    country: 'KE';
    name?: string;
}
export type KenyaBeneficiary = KenyaMobileMoneyBeneficiary | KenyaBuyGoodsBeneficiary | KenyaPaybillBeneficiary;
/** Initialize request — Step 2 */
export interface BitnobInitializeRequest {
    beneficiary: KenyaBeneficiary;
    customer_email?: string;
    metadata?: Record<string, string>;
}
/** Finalize request — Step 3 (empty body) */
export interface BitnobFinalizeRequest {
}
/** Payout lifecycle status returned by GET /api/payouts/:id */
export interface BitnobPayoutStatus {
    id: string;
    status: 'pending' | 'initialized' | 'finalized' | 'processing' | 'success' | 'failed' | 'reversed';
    reference: string;
    from_asset: string;
    to_currency: string;
    from_amount: string;
    settlement_amount: string;
    fee: string;
    exchange_rate: string;
    beneficiary: KenyaBeneficiary;
    failure_reason?: string;
    receipt_number?: string;
    created_at: string;
    updated_at: string;
}
/** Options passed from the payment pipeline to initiatePayout */
export interface PayoutOptions {
    paybillNumber?: string;
    accountNumber?: string;
    tillNumber?: string;
    pochiRecipient?: string;
    recipientName?: string;
}
export declare class BitnobService implements IOfframpService {
    /**
     * Generate HMAC-SHA256 request signature.
     *
     * Signature string: "CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD"
     * where PAYLOAD is the exact JSON body string (empty string for GET).
     */
    private buildAuthHeaders;
    /** Shared fetch with HMAC signing and structured error handling */
    private bitnobFetch;
    /**
     * Normalise a Kenyan phone number to international format (+254XXXXXXXXX).
     * Accepts: 0712345678, 254712345678, +254712345678
     */
    private normaliseKenyaPhone;
    /** Validate a normalised Kenyan M-Pesa phone number */
    private validateKenyaPhone;
    /**
     * Request a locked conversion quote from Bitnob.
     * Quotes expire in ~60 s; we cache per txnId to handle retries gracefully.
     *
     * @param kesAmount  - Settlement amount in KES (what the recipient receives)
     * @param reference  - Our transaction ID (used as idempotency key)
     */
    createQuote(kesAmount: number, reference: string): Promise<BitnobQuoteResponse>;
    /**
     * Attach beneficiary details to a quote.
     *
     * Kenya corridor beneficiary rules:
     *   send / pochi → mobile_money  (phone number, no channel field)
     *   till         → mobile_money  (channel: buy_goods, till_number)
     *   paybill      → mobile_money  (channel: paybill, paybill_number, account_number)
     */
    initializeQuote(quoteId: string, phoneNumber: string | null, payoutType: 'send' | 'pochi' | 'till' | 'paybill', options: PayoutOptions, reference: string): Promise<void>;
    /**
     * Finalize the payout. After this call, Bitnob begins settlement.
     * The payout ID returned here is what we poll / receive webhooks for.
     */
    finalizePayout(quoteId: string, reference: string): Promise<BitnobPayoutStatus>;
    /**
     * Execute the complete Quote → Initialize → Finalize flow for a payout.
     *
     * @param kesAmount   - KES amount recipient should receive (post-fee)
     * @param phoneNumber - Required for send/pochi; null for till/paybill
     * @param reference   - Our transaction ID (idempotency key)
     * @param payoutType  - 'send' | 'pochi' | 'till' | 'paybill'
     * @param options     - tillNumber, paybillNumber, accountNumber, recipientName
     */
    initiatePayout(kesAmount: number, phoneNumber: string | null, reference: string, payoutType?: 'send' | 'pochi' | 'till' | 'paybill', options?: PayoutOptions): Promise<BitnobPayoutStatus>;
    /**
     * Fetch the current status of a payout by its ID (quoteId / payoutId).
     *
     * Endpoint: GET /api/payouts/:id
     */
    getPayoutStatus(payoutId: string, reference?: string): Promise<BitnobPayoutStatus>;
    /**
     * Fetch USDC wallet balance from Bitnob and verify it covers the payout.
     * Uses the live exchange rate returned by the quote endpoint to avoid
     * the previously hardcoded 130 KES/USD stub.
     */
    ensureSufficientBalance(kesAmount: number, reference?: string): Promise<boolean>;
    /** Fetch all wallet balances */
    getWalletBalance(): Promise<{
        usdc: number;
        kes: number;
        btc: number;
    }>;
    /**
     * Fetch live USDC → KES rate from the Bitnob rates endpoint.
     * Falls back to a conservative 130 KES/USDC only if the API is unreachable.
     */
    getLiveUsdcKesRate(): Promise<number>;
    /**
     * Generic exchange rate helper (used by external callers / admin panel)
     */
    getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>;
    /**
     * Called by the payment pipeline: orchestrates the full payout for a txnId.
     */
    initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult>;
    /**
     * Poll status of a running payout.
     */
    checkSwapStatus(swapId: string, reference?: string): Promise<SwapStatus>;
    /**
     * Validate a phone number for a given country.
     * Returns normalized number and detected network.
     */
    validatePhoneNumber(phoneNumber: string, country: BitnobCountry): Promise<{
        valid: boolean;
        network?: string;
        formattedNumber?: string;
    }>;
    /** Fetch list of supported payout countries */
    getSupportedCountries(): Promise<string[]>;
    /**
     * Extract phone number, payout type, and options from a stored transaction.
     */
    private resolvePayoutArgs;
    /**
     * Map Bitnob v2 status strings to our internal SwapStatus.
     *
     * Bitnob v2 lifecycle:
     *   pending → initialized → finalized → processing → success | failed | reversed
     */
    private mapStatus;
    /** Human-readable label for logging */
    private payoutTypeLabel;
    /** Safe redacted description of a beneficiary for logs */
    private describeBeneficiary;
}
export declare const bitnobService: BitnobService;
export declare function createBitnobService(): BitnobService;
//# sourceMappingURL=bitnobService.d.ts.map