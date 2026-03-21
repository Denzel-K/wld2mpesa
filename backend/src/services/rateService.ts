/**
 * rateService.ts — WLD/KES exchange rate provider
 *
 * Simulation: returns hardcoded rate with slight random variation
 * Production: fetches from Kraken API (free, no key required)
 *
 * TODO: PRODUCTION - See TRANSITION_GUIDE.md Step 2
 */

import type { IRateService, RateData } from '../types';

import { prisma } from '../db/prisma';

/** Rate cache — refreshed every 60 seconds in production */
const CACHE_TTL_MS = 60_000;


// ─── Real implementation ──────────────────────────────────────────────────────

class RealRateService implements IRateService {
  /**
   * Fetches live WLD/KES rate from Kraken API (free, no auth required)
   */
  async getWldKesRate(): Promise<RateData> {
    // 1. Check DB Cache first
    const cached = await prisma.rateCache.findFirst({
      orderBy: { fetchedAt: 'desc' },
    });

    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return {
        wldPriceKes: cached.wldPriceKes,
        wldPriceUsd: cached.wldPriceUsd,
        usdKesRate: cached.usdKesRate,
        source: cached.source,
        cachedAt: cached.fetchedAt.toISOString(),
      };
    }

    // 2. Fetch fresh rates from APIs
    try {
      // Fetch WLD/USD from Kraken
      const krakenResp = await fetch('https://api.kraken.com/0/public/Ticker?pair=WLDUSD');
      if (!krakenResp.ok) throw new Error(`Kraken API error: ${krakenResp.status}`);
      const krakenData = await krakenResp.json() as any;

      if (!krakenData.result || (!krakenData.result['WLDUSD'] && !krakenData.result['XWLDZUSD'])) {
        throw new Error('WLDUSD pair not found on Kraken');
      }

      const ticker = krakenData.result['WLDUSD'] || krakenData.result['XWLDZUSD'];
      const wldPriceUsd = parseFloat(ticker.c[0]);

      // Fetch USD/KES from ExchangeRate-API (v4 is free/open)
      const erResp = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!erResp.ok) throw new Error(`ExchangeRate-API error: ${erResp.status}`);
      const erData = await erResp.json() as any;
      const usdKesRate = erData.rates?.['KES'] || 129.50; // Use last known if missing in JSON

      const wldPriceKes = wldPriceUsd * usdKesRate;

      const newRate: RateData = {
        wldPriceKes: parseFloat(wldPriceKes.toFixed(2)),
        wldPriceUsd: parseFloat(wldPriceUsd.toFixed(4)),
        usdKesRate: parseFloat(usdKesRate.toFixed(2)),
        source: 'kraken+exchangerate',
        cachedAt: new Date().toISOString(),
      };

      // 3. Update DB Cache
      await prisma.rateCache.create({
        data: {
          wldPriceKes: newRate.wldPriceKes,
          wldPriceUsd: newRate.wldPriceUsd,
          usdKesRate: newRate.usdKesRate,
          source: newRate.source,
          fetchedAt: new Date(newRate.cachedAt),
        },
      }).catch(() => {
        // Ignore duplicate cache errors
      });

      console.log(`[RateService] Live sync complete: WLD=$${wldPriceUsd}, USD/KES=${usdKesRate}`);
      return newRate;
    } catch (err) {
      console.error('[RateService] Failed to fetch live rates:', err);

      // Fallback to last known cache (even if expired) if available
      if (cached) {
        console.warn('[RateService] Using stale cached rates');
        return {
          wldPriceKes: cached.wldPriceKes,
          wldPriceUsd: cached.wldPriceUsd,
          usdKesRate: cached.usdKesRate,
          source: `${cached.source}_stale`,
          cachedAt: cached.fetchedAt.toISOString(),
        };
      }

      // Final fallback - only if no cache exists at all. 
      // We'll use a hardcoded but distinct error rate or re-throw
      throw new Error('No live rates or cache available');
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRateService(): IRateService {
  return new RealRateService();
}

export const rateService = createRateService();
