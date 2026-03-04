import { Router } from 'express';
import { prisma } from '../db/prisma';
import { paymentService } from '../services/paymentService';

const router = Router();

/**
 * POST /api/mpesa/result
 * M-Pesa B2B disbursement callback
 */
router.post('/result', async (req, res) => {
    const { Result } = req.body;

    if (!Result) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    // Daraja B2B result format:
    // AccountReference contains our internal transaction ID
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
        // 0 = Success
        const receipt = Result.TransactionID;
        console.log(`[Webhook:Mpesa] Payment successful! Receipt: ${receipt}`);
        await paymentService.markSettled(txnId, receipt);
    } else {
        // Failure
        const reason = Result.ResultDesc || 'M-Pesa disbursement failed';
        console.error(`[Webhook:Mpesa] Payment failed: ${reason}`);
        await paymentService.markFailed(txnId, reason);
    }

    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * POST /api/mpesa/timeout
 * M-Pesa queue timeout
 */
router.post('/timeout', async (req, res) => {
    console.warn('[Webhook:Mpesa] Timeout received:', req.body);
    // Optional: Mark transaction as pending investigation
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * POST /api/yellowcard/webhook
 * Yellow Card status update
 */
router.post('/yellowcard/webhook', async (req, res) => {
    // In production, verify HMAC signature from YC-Signature header
    const payload = req.body;
    const { sequenceId: txnId, status, id: swapId } = payload;

    console.log(`[Webhook:YellowCard] Swap ${swapId} for ${txnId} is now ${status}`);

    await prisma.webhookEvent.create({
        data: {
            source: 'yellowcard',
            eventType: 'status_update',
            rawPayload: JSON.stringify(payload),
            transactionId: txnId,
            processedAt: new Date(),
        }
    });

    // If the swap is completed, we don't necessarily call markSettled 
    // because we still need to wait for M-Pesa disbursement.
    // The PaymentService orchestrator handles the state machine.

    return res.json({ success: true });
});

export const webhooksRouter = router;
