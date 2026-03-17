/**
 * offrampService.ts — WLD → KES off-ramp service
 *
 * Simulation: mocks Yellow Card API responses with realistic delays
 * Production: calls Yellow Card Business API (or ZendWallet as alternative)
 *
 * TODO: PRODUCTION - See TRANSITION_GUIDE.md Step 4
 * Sign up: https://yellowcard.io/business
 */

import { config } from '../config';
import type { IOfframpService, SwapResult, SwapStatus } from '../types';

// TODO: PRODUCTION - use these in YellowCardOfframpService.baseUrl getter
const YELLOW_CARD_SANDBOX_URL = 'https://sandbox.api.yellowcard.io/v1';
const YELLOW_CARD_PROD_URL = 'https://api.yellowcard.io/v1';

// ─── Simulated implementation ─────────────────────────────────────────────────

class SimulatedOfframpService implements IOfframpService {
  private swapStatuses = new Map<string, SwapStatus>();

  /**
   * Simulates initiating a WLD → KES swap.
   * Automatically completes after SIM_OFFRAMP_MS delay.
   *
   * TODO: PRODUCTION - Replace with real Yellow Card API call
   *   (see TRANSITION_GUIDE.md Step 4 for full diff)
   */
  async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
    const swapId = `SIM_SWAP_${txnId}`;
    console.log(`[SIMULATED] OfframpService: initiating swap ${swapId}: ${wldAmount} WLD → KES ${kesAmount}`);

    this.swapStatuses.set(swapId, 'PENDING');

    // Simulate async completion
    setTimeout(() => {
      this.swapStatuses.set(swapId, 'COMPLETED');
      console.log(`[SIMULATED] OfframpService: swap ${swapId} COMPLETED`);
    }, config.SIM_OFFRAMP_MS);

    return {
      swapId,
      status: 'PENDING',
      estimatedKes: kesAmount,
    };
  }

  async checkSwapStatus(swapId: string): Promise<SwapStatus> {
    return this.swapStatuses.get(swapId) ?? 'PENDING';
  }
}

// ─── Real implementation (Yellow Card) ───────────────────────────────────────

class YellowCardOfframpService implements IOfframpService {
  private get baseUrl(): string {
    return config.YELLOW_CARD_ENV === 'production' ? YELLOW_CARD_PROD_URL : YELLOW_CARD_SANDBOX_URL;
  }

  /**
   * TODO: PRODUCTION - Create a sell order on Yellow Card.
   *
   * Full diff in TRANSITION_GUIDE.md Step 4.
   * Yellow Card docs: https://docs.yellowcard.io
   *
   * Required env vars:
   *   YELLOW_CARD_API_KEY
   *   YELLOW_CARD_SECRET
   */
  async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
    const { createHmac } = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000); // Yellow Card expects Unix timestamp in seconds

    const bodyObj = {
      country: 'KE',
      networkId: 'world-chain',
      source: { currency: 'WLD', amount: wldAmount },
      destination: { currency: 'KES', accountType: 'business_wallet' },
      sequenceId: txnId,
    };
    const bodyStr = JSON.stringify(bodyObj);

    const signature = createHmac('sha256', config.YELLOW_CARD_SECRET)
      .update(`${timestamp}${bodyStr}`)
      .digest('hex');

    console.log(`[YellowCard] Initiating swap for ${txnId}...`);

    try {
      const response = await fetch(`${this.baseUrl}/business/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `YC-HMAC-SHA256 Credential=${config.YELLOW_CARD_API_KEY}, Timestamp=${timestamp}, Signature=${signature}`,
        },
        body: bodyStr,
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('[YellowCard] API failure:', err);
        throw new Error(`Yellow Card error: ${JSON.stringify(err)}`);
      }

      const data: any = await response.json();
      return {
        swapId: data.id,
        status: 'PENDING',
        estimatedKes: data.destination?.amount || kesAmount,
      };
    } catch (err) {
      console.error('[YellowCard] Swap initiation error:', err);
      throw err;
    }
  }

  async checkSwapStatus(swapId: string): Promise<SwapStatus> {
    const { createHmac } = await import('crypto');
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = createHmac('sha256', config.YELLOW_CARD_SECRET)
      .update(`${timestamp}`)
      .digest('hex');

    try {
      const response = await fetch(`${this.baseUrl}/business/payments/${swapId}`, {
        headers: {
          'Authorization': `YC-HMAC-SHA256 Credential=${config.YELLOW_CARD_API_KEY}, Timestamp=${timestamp}, Signature=${signature}`,
        },
      });

      if (!response.ok) return 'PENDING';

      const data: any = await response.json();
      // Status mapping: completed -> COMPLETED, pending -> PENDING, failed -> FAILED
      const ycStatus = data.status?.toLowerCase();
      if (ycStatus === 'completed' || ycStatus === 'settled') return 'COMPLETED';
      if (ycStatus === 'failed' || ycStatus === 'cancelled') return 'FAILED';
      return 'PENDING';
    } catch (err) {
      console.error('[YellowCard] Status check error:', err);
      return 'PENDING';
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createOfframpService(): IOfframpService {
  return new YellowCardOfframpService();
}

export const offrampService = createOfframpService();
