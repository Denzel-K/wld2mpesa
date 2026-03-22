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
import { prisma } from '../db/prisma';
import type { IOfframpService, SwapResult, SwapStatus } from '../types';

/**
 * BitnobOfframpService — Implementation using Bitnob Payouts API
 * 
 * Flow:
 * 1. Perform Account Lookup (optional but recommended)
 * 2. Call /payouts/mobile-money (or generic /payouts)
 * 
 * Bitnob Docs: https://docs.bitnob.com/docs/mobile-money-payouts
 */
class BitnobOfframpService implements IOfframpService {
  private get baseUrl(): string {
    return config.BITNOB_ENV === 'production' 
      ? 'https://api.bitnob.co/api/v1' 
      : 'https://sandboxapi.bitnob.co/api/v1';
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${config.BITNOB_API_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
    console.log(`[Bitnob] Initiating off-ramp for txn ${txnId}: ${wldAmount} WLD -> ${kesAmount} KES`);
    
    try {
      // In this liquidity model, the txnId is associated with a user's phone number 
      // from the original payment intent. We'll fetch the payment from the DB.
      const payment = await prisma.transaction.findUnique({
        where: { id: txnId },
      });

      if (!payment || !payment.phoneNumber) {
        throw new Error(`Payment ${txnId} not found or missing phone number`);
      }

      // Bitnob Payout API
      // Note: Bitnob automatically converts your USD balance to KES for the recipient.
      const response = await fetch(`${this.baseUrl}/payouts/mobile-money`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          amount: Math.floor(kesAmount * 100), // Bitnob uses cents/smallest unit
          customerEmail: 'dev@wld2mpesa.app', // Placeholder
          reference: txnId,
          sourceWalletCurrency: 'USD',
          beneficiary: {
            phoneNumber: payment.phoneNumber.replace('+', ''), // Bitnob expects numbers without +
            country: 'Kenya',
            type: 'momo',
            network: 'mpesa'
          }
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        console.error('[Bitnob] API Error:', data);
        throw new Error(`Bitnob Error: ${data.message || 'Unknown error'}`);
      }

      return {
        swapId: data.id || data.data?.id,
        status: 'PENDING',
        estimatedKes: kesAmount,
      };
    } catch (err) {
      console.error('[Bitnob] initiateSwap failed:', err);
      throw err;
    }
  }

  async checkSwapStatus(swapId: string): Promise<SwapStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/payouts/${swapId}`, {
        headers: this.headers,
      });

      if (!response.ok) return 'PENDING';

      const data = await response.json() as any;
      const status = (data.status || data.data?.status)?.toLowerCase();

      if (status === 'success' || status === 'completed' || status === 'successful') return 'COMPLETED';
      if (status === 'failed' || status === 'rejected') return 'FAILED';
      
      return 'PENDING';
    } catch (err) {
      console.error('[Bitnob] checkSwapStatus failed:', err);
      return 'PENDING';
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createOfframpService(): IOfframpService {
  return new BitnobOfframpService();
}

export const offrampService = createOfframpService();
