/**
 * rateService.ts — WLD/KES exchange rate provider
 *
 * Simulation: returns hardcoded rate with slight random variation
 * Production: fetches from CoinGecko API (free tier OK)
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
   * TODO: PRODUCTION - Fetches live WLD/KES rate from CoinGecko
   *
   * Diff from TRANSITION_GUIDE.md Step 2:
   *   Remove the hardcoded return and uncomment the fetch below.
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

    // 2. Fetch fresh rates from CoinGecko
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (config.COINGECKO_API_KEY && config.COINGECKO_API_KEY !== 'YOUR_COINGECKO_API_KEY') {
        headers['x-cg-api-key'] = config.COINGECKO_API_KEY;
      }

      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=worldcoin-wld&vs_currencies=kes,usd',
        { headers }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, Record<string, number>>;
      const wldData = data['worldcoin-wld'];

      if (!wldData || !wldData.kes || !wldData.usd) {
        throw new Error('Invalid response from CoinGecko');
      }

      const newRate: RateData = {
        wldPriceKes: wldData.kes,
        wldPriceUsd: wldData.usd,
        usdKesRate: wldData.kes / wldData.usd,
        source: 'coingecko',
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
      });

      return newRate;
    } catch (err) {
      console.error('[RateService] Failed to fetch live rates:', err);

      // Fallback to last known cache (even if expired) if available
      if (cached) {
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
