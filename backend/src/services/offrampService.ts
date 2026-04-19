/**
 * offrampService.ts — WLD → KES off-ramp service
 *
 * This service acts as a thin wrapper around the BitnobService.
 * All Bitnob-specific logic has been moved to bitnobService.ts for better
 * maintainability and separation of concerns.
 *
 * @see bitnobService.ts for the full Bitnob API implementation
 */

import { bitnobService, BitnobService } from './bitnobService';
import type { IOfframpService, SwapResult, SwapStatus } from '../types';

/**
 * OfframpService — Delegates to BitnobService
 *
 * This wrapper maintains backward compatibility while using
 * the new comprehensive Bitnob API implementation.
 */
class OfframpService implements IOfframpService {
  private bitnob: BitnobService;

  constructor() {
    this.bitnob = bitnobService;
  }

  async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
    console.log(`[OfframpService] Initiating Bitnob off-ramp for txn ${txnId}: ${wldAmount} WLD -> ${kesAmount} KES`);
    return this.bitnob.initiateSwap(wldAmount, kesAmount, txnId);
  }

  async checkSwapStatus(swapId: string): Promise<SwapStatus> {
    return this.bitnob.checkSwapStatus(swapId);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createOfframpService(): IOfframpService {
  return new OfframpService();
}

// Export singleton instance (backward compatible)
export const offrampService = createOfframpService();

// Re-export BitnobService for direct access if needed
export { bitnobService, BitnobService };
