/**
 * payment.routes.ts — Payment API routes
 *
 * POST /api/payment/initiate  — create transaction + get WLD amount
 * POST /api/payment/confirm   — record MiniKit txHash + start pipeline
 * GET  /api/payment/status/:id — poll transaction status
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paymentService } from '../services/paymentService';
import { transactionStore } from '../services/transactionStore';

export const paymentRouter = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const initiateSchema = z.object({
  transactionType: z.enum(['send', 'paybill', 'pochi', 'till']).default('till'),
  kesAmount: z.number().min(10).max(150000),
  tillNumber: z.string().regex(/^\d{5,7}$/, 'Invalid Business/Till number').optional(),
  phoneNumber: z.string().regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Phone number').optional(),
  accountNumber: z.string().optional(),
  walletAddress: z.string().min(1), // Relaxed for simulation/demo
  worldIdProof: z.unknown().optional(),
});

const confirmSchema = z.object({
  transactionId: z.string().min(1),
  txHash: z.string().min(1),
  miniKitPayload: z.unknown(),
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
paymentRouter.post('/initiate', asyncHandler(async (req: Request, res: Response) => {
  const body = initiateSchema.parse(req.body);

  const result = await paymentService.initiatePayment({
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

/**
 * POST /api/payment/confirm
 *
 * Called immediately after MiniKit pay() succeeds.
 * Records the txHash and starts the background payment pipeline.
 *
 * TODO: PRODUCTION - Verify MiniKit payload signature (TRANSITION_GUIDE Step 6)
 * TODO: PRODUCTION - Verify World ID proof if present (TRANSITION_GUIDE Step 7)
 */
paymentRouter.post('/confirm', asyncHandler(async (req: Request, res: Response) => {
  const body = confirmSchema.parse(req.body);

  // TODO: PRODUCTION - Uncomment MiniKit payload verification:
  // const isValid = await MiniKit.validatePayment({ payload: body.miniKitPayload, ... });
  // if (!isValid) return res.status(400).json({ error: 'Invalid MiniKit payload' });

  const result = await paymentService.confirmPayment({
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
paymentRouter.get('/status/:transactionId', asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  if (!transactionId) {
    res.status(400).json({ error: 'Missing transactionId' });
    return;
  }
  const status = await paymentService.getTransactionStatus(transactionId);
  res.json(status);
}));

/**
 * GET /api/payment/history/:walletAddress
 *
 * Returns full transaction history for a specific wallet.
 */
paymentRouter.get('/history/:walletAddress', asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  if (!walletAddress) {
    res.status(400).json({ error: 'Missing walletAddress' });
    return;
  }

  const history = await transactionStore.getAll(walletAddress);
  res.json(history);
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
