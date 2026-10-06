"use strict";
/**
 * payment.routes.ts — Payment API routes
 *
 * POST /api/payment/initiate  — create transaction + get WLD amount
 * POST /api/payment/confirm   — record MiniKit txHash + start pipeline
 * GET  /api/payment/status/:id — poll transaction status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const paymentService_1 = require("../services/paymentService");
const transactionStore_1 = require("../services/transactionStore");
const worldChainListener_1 = require("../services/worldChainListener");
const logger_1 = require("../utils/logger");
const rateService_1 = require("../services/rateService");
const pricingService_1 = require("../services/pricingService");
exports.paymentRouter = (0, express_1.Router)();
// ─── Validation schemas ───────────────────────────────────────────────────────
const initiateSchema = zod_1.z.object({
    transactionType: zod_1.z.enum(['send', 'paybill', 'pochi', 'till']).default('till'),
    kesAmount: zod_1.z.number().min(10).max(150000),
    tillNumber: zod_1.z.string().regex(/^\d{5,7}$/, 'Invalid Business/Till number').optional(),
    phoneNumber: zod_1.z.string().regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Phone number').optional(),
    accountNumber: zod_1.z.string().optional(),
    walletAddress: zod_1.z.string().min(1), // Relaxed for simulation/demo
    worldIdProof: zod_1.z.unknown().optional(),
});
const confirmSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    txHash: zod_1.z.string().min(1),
    miniKitPayload: zod_1.z.unknown(),
});
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * POST /api/payment/initiate
 *
 * Creates a new transaction. Returns WLD amount + address to pay.
 * Called before MiniKit pay().
 *
 * TODO: PRODUCTION - Add rate limiting per walletAddress
 * TODO: PRODUCTION - Verify no duplicate in-flight transactions for same wallet
 */
exports.paymentRouter.post('/initiate', asyncHandler(async (req, res) => {
    const body = initiateSchema.parse(req.body);
    const result = await paymentService_1.paymentService.initiatePayment({
        transactionType: body.transactionType,
        kesAmount: body.kesAmount,
        tillNumber: body.tillNumber,
        phoneNumber: body.phoneNumber,
        accountNumber: body.accountNumber,
        walletAddress: body.walletAddress,
        worldIdProof: body.worldIdProof,
    });
    res.json(result);
}));
/** Server-authoritative preview. Never trust a client-side fee calculation. */
exports.paymentRouter.post('/quote', asyncHandler(async (req, res) => {
    const body = initiateSchema.pick({ transactionType: true, kesAmount: true }).parse(req.body);
    const rate = await rateService_1.rateService.getWldKesRate();
    res.json((0, pricingService_1.quotePayment)(body.kesAmount, body.transactionType, rate.wldPriceKes));
}));
/**
 * POST /api/payment/confirm
 *
 * Called immediately after MiniKit pay() succeeds.
 * Records the txHash and starts the background payment pipeline.
 *
 * TODO: PRODUCTION - Verify MiniKit payload signature (TRANSITION_GUIDE Step 6)
 * TODO: PRODUCTION - Verify World ID proof if present (TRANSITION_GUIDE Step 7)
 */
exports.paymentRouter.post('/confirm', asyncHandler(async (req, res) => {
    const body = confirmSchema.parse(req.body);
    // 1. Verify MiniKit payload signature (Crucial for PRODUCTION)
    // Note: On-chain transaction verification is handled by worldChainListener in the payment pipeline.
    // Verification of the MiniKit response payload signature can be added here if needed for extra security.
    const result = await paymentService_1.paymentService.confirmPayment({
        transactionId: body.transactionId,
        txHash: body.txHash,
        miniKitPayload: body.miniKitPayload,
    });
    res.json(result);
}));
/**
 * GET /api/payment/status/:transactionId
 *
 * Frontend polls this every 3 seconds to track pipeline progress.
 */
exports.paymentRouter.get('/status/:transactionId', asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    if (!transactionId) {
        res.status(400).json({ error: 'Missing transactionId' });
        return;
    }
    const status = await paymentService_1.paymentService.getTransactionStatus(transactionId);
    res.json(status);
}));
/**
 * GET /api/payment/history/:walletAddress
 *
 * Returns full transaction history for a specific wallet.
 */
exports.paymentRouter.get('/history/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    if (!walletAddress) {
        res.status(400).json({ error: 'Missing walletAddress' });
        return;
    }
    const history = await transactionStore_1.transactionStore.getAll(walletAddress);
    res.json(history);
}));
/**
 * GET /api/payment/balance/:walletAddress
 *
 * Returns WLD balance for a specific wallet address.
 */
exports.paymentRouter.get('/balance/:walletAddress', asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;
    if (!walletAddress) {
        res.status(400).json({ error: 'Missing walletAddress' });
        return;
    }
    const balance = await worldChainListener_1.worldChainListener.getWldBalance(walletAddress);
    res.json({
        walletAddress,
        balanceWld: balance,
        balanceWei: (BigInt(parseFloat(balance) * 1e18)).toString(),
    });
}));
/**
 * GET /api/payment/transaction/:transactionId
 *
 * Returns full transaction detail for the modal view.
 * Includes all pipeline steps, timestamps, amounts, and audit info.
 */
exports.paymentRouter.get('/transaction/:transactionId', asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    if (!transactionId) {
        res.status(400).json({ error: 'Missing transactionId' });
        return;
    }
    const tx = await transactionStore_1.transactionStore.get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    const statusResult = await paymentService_1.paymentService.getTransactionStatus(transactionId);
    res.json({
        ...statusResult,
        wldAmount: tx.wldAmount,
        feeWld: tx.feeWld,
        feeKes: tx.feeKes,
        platformFeeKes: tx.platformFeeKes ?? null,
        safaricomFeeKes: tx.safaricomFeeKes ?? null,
        gasBufferKes: tx.gasBufferKes ?? null,
        bitnobFeeKes: tx.bitnobFeeKes ?? null,
        dexFeeKes: tx.dexFeeKes ?? null,
        netPlatformRevenueKes: tx.netPlatformRevenueKes ?? null,
        wldRate: tx.wldRate,
        txHash: tx.txHash,
        offrampId: tx.offrampId,
        mpesaConversationId: tx.mpesaConversationId,
        createdAt: tx.createdAt,
        confirmedAt: tx.confirmedAt,
        offrampAt: tx.offrampAt,
        mpesaSentAt: tx.mpesaSentAt,
        walletAddress: tx.walletAddress,
        payToAddress: tx.payToAddress,
        refundStatus: tx.refundStatus ?? null,
        refundTxHash: tx.refundTxHash ?? null,
    });
}));
/**
 * POST /api/payment/:transactionId/refund
 *
 * Initiates an automatic WLD refund for FAILED or stuck transactions.
 * Conflict resolution entry point — marks transaction for refund processing.
 */
exports.paymentRouter.post('/:transactionId/refund', asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { walletAddress } = req.body;
    if (!transactionId || !walletAddress) {
        res.status(400).json({ error: 'Missing transactionId or walletAddress' });
        return;
    }
    const tx = await transactionStore_1.transactionStore.get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    if (tx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized: wallet address mismatch' });
        return;
    }
    // Never refund after a payout was sent/settled: that risks paying twice.
    const refundEligibleStatuses = ['FAILED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED'];
    if (!refundEligibleStatuses.includes(tx.status)) {
        res.status(400).json({ error: `Transaction in status ${tx.status} is not eligible for refund` });
        return;
    }
    if (tx.refundStatus === 'REFUNDED') {
        res.status(400).json({ error: 'Refund already processed for this transaction' });
        return;
    }
    await paymentService_1.paymentService.initiateRefund(transactionId, walletAddress);
    res.json({
        success: true,
        transactionId,
        message: 'Refund initiated. WLD will be returned to your wallet within 1–5 minutes.',
        refundStatus: 'REFUND_INITIATED',
    });
}));
/**
 * POST /api/payment/:transactionId/cancel
 * Cancels an INITIATED transaction. No WLD was ever sent — safe to void.
 */
exports.paymentRouter.post('/:transactionId/cancel', asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { walletAddress } = req.body;
    if (!transactionId || !walletAddress) {
        res.status(400).json({ error: 'Missing transactionId or walletAddress' });
        return;
    }
    const tx = await transactionStore_1.transactionStore.get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    if (tx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized: wallet address mismatch' });
        return;
    }
    if (tx.status !== 'INITIATED') {
        res.status(400).json({ error: `Cannot cancel a transaction in status ${tx.status}. Only INITIATED transactions can be cancelled.` });
        return;
    }
    await transactionStore_1.transactionStore.update(transactionId, {
        status: 'FAILED',
        failureReason: 'Cancelled by user — no WLD was transferred',
        failedAt: new Date().toISOString(),
    });
    logger_1.logger.info('PAYMENT', 'Transaction cancelled by user (INITIATED — no WLD transferred)', transactionId, {
        wallet: (0, logger_1.maskWalletAddress)(walletAddress),
    });
    res.json({ success: true, transactionId, message: 'Transaction cancelled. No WLD was deducted from your wallet.' });
}));
/**
 * POST /api/payment/:transactionId/retry
 * Re-kicks the payment pipeline for stuck transactions.
 * Eligible: PENDING_CONFIRMATION, CONFIRMED, SWAP_COMPLETED, OFFRAMP_INITIATED, MPESA_SENT
 * WLD was already transferred — we attempt to complete the disbursement pipeline.
 */
exports.paymentRouter.post('/:transactionId/retry', asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const { walletAddress } = req.body;
    if (!transactionId || !walletAddress) {
        res.status(400).json({ error: 'Missing transactionId or walletAddress' });
        return;
    }
    const tx = await transactionStore_1.transactionStore.get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    if (tx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(403).json({ error: 'Unauthorized: wallet address mismatch' });
        return;
    }
    const retryEligible = ['PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
    if (!retryEligible.includes(tx.status)) {
        res.status(400).json({ error: `Transaction in status ${tx.status} is not eligible for retry.` });
        return;
    }
    logger_1.logger.info('PAYMENT', 'Pipeline retry requested by user', transactionId, {
        wallet: (0, logger_1.maskWalletAddress)(walletAddress),
        currentStatus: tx.status,
    });
    void paymentService_1.paymentService.processPaymentPipeline(transactionId);
    res.json({
        success: true,
        transactionId,
        message: 'Pipeline retry initiated. Your transaction is being re-processed.',
        currentStatus: tx.status,
    });
}));
// ─── Helper ───────────────────────────────────────────────────────────────────
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
//# sourceMappingURL=payment.routes.js.map