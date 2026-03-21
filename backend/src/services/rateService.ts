/**
 * rateService.ts — WLD/KES exchange rate provider
 *
 * Simulation: returns hardcoded rate with slight random variation
 * Production: fetches from Kraken API (free, no key required)
 *
 * TODO: PRODUCTION - See TRANSITION_GUIDE.md Step 2
 */

import { config } from '../config';
import type { IRateService, RateData } from '../types';

import { prisma } from '../db/prisma';

/** Rate cache — refreshed every 60 seconds in production */
const CACHE_TTL_MS = 60_000;

// ─── Simulated implementation ─────────────────────────────────────────────────

class SimulatedRateService implements IRateService {
  /**
   * Returns a realistic but fixed WLD/KES rate.
   * Adds ±2% random jitter to simulate live market movement.
   */
  async getWldKesRate(): Promise<RateData> {
    const BASE_WLD_USD = 2.45;
    const BASE_USD_KES = 129.20;
    // ±2% jitter
    const jitter = 0.98 + Math.random() * 0.04;
    const wldPriceUsd = parseFloat((BASE_WLD_USD * jitter).toFixed(4));
    const wldPriceKes = parseFloat((wldPriceUsd * BASE_USD_KES).toFixed(2));

    return {
      wldPriceKes,
      wldPriceUsd,
      usdKesRate: BASE_USD_KES,
      source: 'simulated',
      cachedAt: new Date().toISOString(),
    };
  }
}

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

    // 2. Fetch fresh rates from Kraken API
    try {
      // Kraken often doesn't have local currency pairs like USDKES.
      // We'll try to get WLD/USD and then use a stable fallback for USD/KES.
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=WLDUSD');
      
      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.status}`);
      }

      const data = await response.json() as any;

      if (!data.result || (!data.result['WLDUSD'] && !data.result['XWLDZUSD'])) {
        console.warn('[RateService] WLDUSD not found in Kraken response, using fallback.');
        throw new Error('WLDUSD pair not found');
      }

      const ticker = data.result['WLDUSD'] || data.result['XWLDZUSD'];
      const wldPriceUsd = parseFloat(ticker.c[0]);
      
      // USD/KES is rarely available on Kraken. We'll use a fixed but realistic rate (e.g. 129.50)
      // in development/sandbox, or you could integrate a real forex API here.
      const usdKesRate = 129.50; 
      const wldPriceKes = wldPriceUsd * usdKesRate;

      const newRate: RateData = {
        wldPriceKes: parseFloat(wldPriceKes.toFixed(2)),
        wldPriceUsd: parseFloat(wldPriceUsd.toFixed(4)),
        usdKesRate: parseFloat(usdKesRate.toFixed(2)),
        source: 'kraken+fallback',
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

      console.log('[RateService] Fetched rates from Kraken');
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

      // If we don't have any cached rates, fall back to a simulated rate so the app stays usable.
      console.warn('[RateService] No cached rate available; falling back to simulated rate.');
      return new SimulatedRateService().getWldKesRate();
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRateService(): IRateService {
  return new RealRateService();
}

export const rateService = createRateService();
