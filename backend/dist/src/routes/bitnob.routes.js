"use strict";
/**
 * bitnob.routes.ts — Bitnob Webhook Handler
 *
 * Handles incoming webhooks from Bitnob for payout status updates.
 * Bitnob sends webhooks when:
 * - Payout is initiated
 * - Payout is completed successfully
 * - Payout fails
 * - Payout is reversed
 *
 * @see https://docs.bitnob.com/docs/webhooks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bitnobRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const paymentService_1 = require("../services/paymentService");
const transactionStore_1 = require("../services/transactionStore");
const bitnobService_1 = require("../services/bitnobService");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
exports.bitnobRouter = (0, express_1.Router)();
// ─── Webhook Secret Verification ─────────────────────────────────────────────
/**
 * Verify Bitnob webhook signature using HMAC SHA-256
 *
 * Bitnob signs webhooks with the BITNOB_SECRET_KEY using HMAC SHA-256.
 * The signature is sent in the x-bitnob-signature header.
 *
 * @param payload - The raw request body (string)
 * @param signature - The signature from x-bitnob-signature header
 * @param secret - The BITNOB_SECRET_KEY from config
 * @returns boolean - True if signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) {
        logger_1.logger.warn('BITNOB', 'Missing signature or secret for verification');
        return false;
    }
    try {
        const expectedSignature = crypto_1.default
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('hex');
        // Use timing-safe comparison to prevent timing attacks
        const sigBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto_1.default.timingSafeEqual(sigBuffer, expectedBuffer);
    }
    catch (error) {
        logger_1.logger.error('BITNOB', 'Signature verification error', undefined, error);
        return false;
    }
}
// ─── Webhook Handler ───────────────────────────────────────────────────────────
/**
 * POST /api/webhooks/bitnob
 *
 * Receives payout status updates from Bitnob.
 * Updates transaction status in our database.
 */
exports.bitnobRouter.post('/', async (req, res) => {
    try {
        // Get raw body and signature for verification
        const rawBody = JSON.stringify(req.body);
        const signature = req.headers['x-bitnob-signature'] || req.headers['X-Bitnob-Signature'];
        // Verify webhook signature
        if (!verifyWebhookSignature(rawBody, signature, config_1.config.BITNOB_SECRET_KEY)) {
            logger_1.logger.securityEvent('Invalid Bitnob webhook signature received', {
                ip: req.ip,
                signature: signature ? `${signature.slice(0, 10)}...` : 'missing',
            });
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        logger_1.logger.info('BITNOB', 'Received valid webhook', undefined, {
            event: req.body.event || req.body.type,
            signature: `${signature.slice(0, 10)}...`,
        });
        // Acknowledge receipt immediately (prevent Bitnob retries)
        res.status(200).json({ received: true });
        // Process webhook asynchronously
        const payload = req.body;
        // Handle different event types
        const eventType = payload.event || payload.type || 'payout.update';
        const eventData = payload.data || payload;
        switch (eventType) {
            // v2 Payouts API event names
            case 'payout.initiated':
            case 'payout.pending':
            case 'payout.initialized':
            case 'payout.finalized':
            case 'payout.processing':
                await handlePayoutPending(eventData);
                break;
            case 'payout.success':
            case 'payout.succeeded':
            case 'payout.completed':
                await handlePayoutSuccess(eventData);
                break;
            case 'payout.failed':
            case 'payout.rejected':
                await handlePayoutFailed(eventData);
                break;
            case 'payout.reversed':
                await handlePayoutReversed(eventData);
                break;
            default:
                logger_1.logger.warn('BITNOB', `Unhandled event type: ${eventType}`);
        }
    }
    catch (err) {
        console.error('[Bitnob Webhook] Error processing webhook:', err);
        // Already sent 200, log error for monitoring
    }
});
// ─── Event Handlers ──────────────────────────────────────────────────────────
async function handlePayoutPending(data) {
    const reference = data.reference || data.metadata?.reference;
    if (!reference) {
        console.warn('[Bitnob Webhook] No reference in payout.pending event');
        return;
    }
    console.log(`[Bitnob Webhook] Payout pending for transaction: ${reference}`);
    // Update transaction status
    await transactionStore_1.transactionStore.update(reference, {
        status: 'OFFRAMP_INITIATED',
        offrampAt: new Date().toISOString(),
    });
}
async function handlePayoutSuccess(data) {
    const reference = data.reference || data.metadata?.reference;
    if (!reference) {
        console.warn('[Bitnob Webhook] No reference in payout.success event');
        return;
    }
    console.log(`[Bitnob Webhook] Payout successful for transaction: ${reference}`);
    // Get M-Pesa receipt from v2 API response (field: receipt_number)
    const receiptNumber = data.receipt_number ||
        data.receiptNumber ||
        data.mpesaReceiptNumber ||
        data.transactionId;
    // Mark transaction as settled
    await paymentService_1.paymentService.markSettled(reference, receiptNumber || `BITNOB-${Date.now()}`);
    logger_1.logger.info('BITNOB', `Transaction settled`, reference, { receipt: receiptNumber });
}
async function handlePayoutFailed(data) {
    const reference = data.reference || data.metadata?.reference;
    if (!reference) {
        console.warn('[Bitnob Webhook] No reference in payout.failed event');
        return;
    }
    const reason = data.reason || data.failureReason || 'Payout failed';
    console.error(`[Bitnob Webhook] Payout failed for transaction: ${reference}, reason: ${reason}`);
    // Mark transaction as failed
    await paymentService_1.paymentService.markFailed(reference, reason);
}
async function handlePayoutReversed(data) {
    const reference = data.reference || data.metadata?.reference;
    if (!reference) {
        console.warn('[Bitnob Webhook] No reference in payout.reversed event');
        return;
    }
    console.warn(`[Bitnob Webhook] Payout reversed for transaction: ${reference}`);
    // Mark transaction as failed with reversal reason
    await paymentService_1.paymentService.markFailed(reference, 'Payout was reversed - funds returned');
}
// ─── Status Check Endpoint ───────────────────────────────────────────────────
/**
 * GET /api/webhooks/bitnob/status/:transactionId
 *
 * Manual status check endpoint (for debugging or when webhooks fail)
 */
exports.bitnobRouter.get('/status/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const tx = await transactionStore_1.transactionStore.get(transactionId);
        if (!tx || !tx.offrampId) {
            res.status(404).json({ error: 'Transaction or offramp ID not found' });
            return;
        }
        // Check status directly with Bitnob
        const status = await bitnobService_1.bitnobService.checkSwapStatus(tx.offrampId);
        const payout = await bitnobService_1.bitnobService.getPayoutStatus(tx.offrampId);
        res.json({
            transactionId,
            offrampId: tx.offrampId,
            status,
            bitnobStatus: payout.status,
            amount: payout.settlement_amount,
            currency: payout.to_currency,
            reason: payout.failure_reason,
        });
    }
    catch (err) {
        console.error('[Bitnob Router] Status check failed:', err);
        res.status(500).json({ error: 'Failed to check status' });
    }
});
// ─── Bitnob API Test Endpoint ─────────────────────────────────────────────────
/**
 * POST /api/webhooks/bitnob/test
 *
 * Test Bitnob API connectivity (development only)
 */
exports.bitnobRouter.post('/test', async (_req, res) => {
    if (config_1.config.IS_PRODUCTION) {
        res.status(403).json({ error: 'Test endpoint not available in production' });
        return;
    }
    try {
        // Test exchange rate fetch
        const rate = await bitnobService_1.bitnobService.getExchangeRate('USDC', 'KES');
        res.json({
            success: true,
            environment: config_1.config.BITNOB_ENV,
            baseUrl: 'https://api.bitnob.com',
            usdcToKesRate: rate,
            message: 'Bitnob API v2 connection successful',
            note: 'Authentication uses HMAC-SHA256 (X-Auth-Client / X-Auth-Signature)',
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger_1.logger.error('BITNOB', 'API connectivity test failed', undefined, err);
        res.status(500).json({
            success: false,
            error: msg,
            hint: 'Check BITNOB_CLIENT_ID and BITNOB_SECRET_KEY are set correctly in .env',
        });
    }
});
//# sourceMappingURL=bitnob.routes.js.map