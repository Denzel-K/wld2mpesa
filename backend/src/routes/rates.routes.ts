/**
 * rates.routes.ts — Exchange rate routes
 *
 * GET /api/rates/wld-kes — current WLD/KES rate
 */

import { Router, Request, Response, NextFunction } from 'express';
import { rateService } from '../services/rateService';

export const ratesRouter = Router();

/**
 * GET /api/rates/wld-kes
 *
 * Returns current WLD/KES rate.
 * Simulation: returns hardcoded rate with jitter
 * Production: fetches from CoinGecko (cached 60s)
 */
ratesRouter.get('/wld-kes', asyncHandler(async (_req: Request, res: Response) => {
  const rate = await rateService.getWldKesRate();
  res.json(rate);
}));

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
