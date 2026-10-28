/**
 * webhooks.routes.ts — M-Pesa / Bitnob Webhook Handlers
 *
 * NOTE: Bitnob handles ALL disbursement channels (send, pochi, till, paybill).
 * The primary Bitnob webhook handler is at /api/webhooks/bitnob (bitnob.routes.ts).
 *
 * This file handles Safaricom Daraja B2B callbacks IF they are ever used as a
 * fallback. Currently unused — retained for reference only.
 */

import { Router } from 'express';
import { prisma } from '../db/prisma';
import { paymentService } from '../services/paymentService';

const router = Router();

/**
 * POST /api/mpesa/result
 * M-Pesa B2B disbursement callback (legacy — not used with Bitnob-only pipeline).
 * Kept for potential future direct M-Pesa integration.
 */
router.post('/result', async (req, res) => {
    const { Result } = req.body;

    if (!Result) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    // Daraja B2B result format: AccountReference contains our internal transaction ID
    const txnId = Result.ReferenceData?.ReferenceItem?.find(
        (i: any) => i.Key === 'AccountReference'
    )?.Value;

    console.log(`[Webhook:Mpesa] Received result for ${txnId}. Code: ${Result.ResultCode}`);

    // Create audit trail
    await prisma.webhookEvent.create({
        data: {
            source: 'mpesa',
            eventType: 'result',
            rawPayload: JSON.stringify(req.body),
            transactionId: txnId,
            processedAt: new Date(),
        }
    });

    if (!txnId) {
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (Result.ResultCode === 0) {
        const receipt = Result.TransactionID;
        console.log(`[Webhook:Mpesa] Payment successful! Receipt: ${receipt}`);
        await paymentService.markSettled(txnId, receipt);
    } else {
        const reason = Result.ResultDesc || 'M-Pesa disbursement failed';
        console.error(`[Webhook:Mpesa] Payment failed: ${reason}`);
        await paymentService.markFailed(txnId, reason);
    }

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * POST /api/mpesa/timeout
 * M-Pesa queue timeout (legacy — not used with Bitnob-only pipeline).
 */
router.post('/timeout', async (req, res) => {
    console.warn('[Webhook:Mpesa] Timeout received:', req.body);
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

export const webhooksRouter = router;
