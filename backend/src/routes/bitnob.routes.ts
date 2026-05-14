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

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentService } from '../services/paymentService';
import { transactionStore } from '../services/transactionStore';
import { bitnobService } from '../services/bitnobService';
import { config } from '../config';
import { logger } from '../utils/logger';

export const bitnobRouter = Router();

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
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    logger.warn('BITNOB_WEBHOOK', 'Missing signature or secret for verification');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    logger.error('BITNOB_WEBHOOK', 'Signature verification error', undefined, error);
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
bitnobRouter.post('/', async (req: Request, res: Response) => {
  try {
    // Get raw body and signature for verification
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-bitnob-signature'] as string || req.headers['X-Bitnob-Signature'] as string;
    
    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, config.BITNOB_SECRET_KEY)) {
      logger.securityEvent('Invalid Bitnob webhook signature received', { 
        ip: req.ip,
        signature: signature ? `${signature.slice(0, 10)}...` : 'missing',
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    logger.info('BITNOB_WEBHOOK', 'Received valid webhook', undefined, { 
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
      case 'payout.initiated':
      case 'payout.pending':
        await handlePayoutPending(eventData);
        break;

      case 'payout.success':
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
        console.log(`[Bitnob Webhook] Unknown event type: ${eventType}`);
    }
  } catch (err) {
    console.error('[Bitnob Webhook] Error processing webhook:', err);
    // Already sent 200, log error for monitoring
  }
});

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handlePayoutPending(data: any): Promise<void> {
  const reference = data.reference || data.metadata?.reference;
  if (!reference) {
    console.warn('[Bitnob Webhook] No reference in payout.pending event');
    return;
  }

  console.log(`[Bitnob Webhook] Payout pending for transaction: ${reference}`);

  // Update transaction status
  await transactionStore.update(reference, {
    status: 'OFFRAMP_INITIATED',
    offrampAt: new Date().toISOString(),
  });
}

async function handlePayoutSuccess(data: any): Promise<void> {
  const reference = data.reference || data.metadata?.reference;
  if (!reference) {
    console.warn('[Bitnob Webhook] No reference in payout.success event');
    return;
  }

  console.log(`[Bitnob Webhook] Payout successful for transaction: ${reference}`);

  // Get receipt number from Bitnob if available
  const receiptNumber = data.receiptNumber || data.mpesaReceiptNumber || data.transactionId;

  // Mark transaction as settled
  await paymentService.markSettled(reference, receiptNumber || 'BITNOB-' + Date.now());
}

async function handlePayoutFailed(data: any): Promise<void> {
  const reference = data.reference || data.metadata?.reference;
  if (!reference) {
    console.warn('[Bitnob Webhook] No reference in payout.failed event');
    return;
  }

  const reason = data.reason || data.failureReason || 'Payout failed';
  console.error(`[Bitnob Webhook] Payout failed for transaction: ${reference}, reason: ${reason}`);

  // Mark transaction as failed
  await paymentService.markFailed(reference, reason);
}

async function handlePayoutReversed(data: any): Promise<void> {
  const reference = data.reference || data.metadata?.reference;
  if (!reference) {
    console.warn('[Bitnob Webhook] No reference in payout.reversed event');
    return;
  }

  console.warn(`[Bitnob Webhook] Payout reversed for transaction: ${reference}`);

  // Mark transaction as failed with reversal reason
  await paymentService.markFailed(reference, 'Payout was reversed - funds returned');
}

// ─── Status Check Endpoint ───────────────────────────────────────────────────

/**
 * GET /api/webhooks/bitnob/status/:transactionId
 *
 * Manual status check endpoint (for debugging or when webhooks fail)
 */
bitnobRouter.get('/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const tx = await transactionStore.get(transactionId);

    if (!tx || !tx.offrampId) {
      res.status(404).json({ error: 'Transaction or offramp ID not found' });
      return;
    }

    // Check status directly with Bitnob
    const status = await bitnobService.checkSwapStatus(tx.offrampId);
    const payout = await bitnobService.getPayoutStatus(tx.offrampId);

    res.json({
      transactionId,
      offrampId: tx.offrampId,
      status,
      bitnobStatus: payout.status,
      amount: payout.amount,
      currency: payout.currency,
      reason: payout.reason,
    });
  } catch (err) {
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
bitnobRouter.post('/test', async (req: Request, res: Response) => {
  if (config.IS_PRODUCTION) {
    res.status(403).json({ error: 'Test endpoint not available in production' });
    return;
  }

  try {
    // Test exchange rate fetch
    const rate = await bitnobService.getExchangeRate('USD', 'KES');

    res.json({
      success: true,
      environment: config.BITNOB_ENV,
      baseUrl: config.BITNOB_ENV === 'production'
        ? 'https://api.bitnob.co/api/v1'
        : 'https://sandboxapi.bitnob.co/api/v1',
      usdToKesRate: rate,
      message: 'Bitnob API connection successful',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Bitnob Router] Test failed:', err);
    res.status(500).json({
      success: false,
      error: msg,
      hint: 'Check BITNOB_API_KEY is set correctly in .env',
    });
  }
});
