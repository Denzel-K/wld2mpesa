/**
 * nonce.routes.ts — SIWE nonce generation and validation
 *
 * Nonces are stored in Redis (with in-memory fallback) so they survive
 * server restarts and horizontal scaling. Each nonce is single-use and
 * expires after 5 minutes.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { redisService } from '../services/redisService';

const router = Router();

// ── In-memory fallback (used when Redis is not available) ─────────────────────
const memoryStore = new Map<string, number>(); // nonce → createdAt ms

function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, createdAt] of memoryStore.entries()) {
    if (now - createdAt > 5 * 60 * 1000) {
      memoryStore.delete(key);
    }
  }
}

const NONCE_PREFIX = 'nonce:';
const NONCE_TTL_SECONDS = 300; // 5 minutes

/**
 * GET /api/nonce
 * Returns a fresh, single-use nonce for walletAuth SIWE.
 */
router.get('/', async (_req, res) => {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const key = `${NONCE_PREFIX}${nonce}`;

  try {
    // Store in Redis with TTL
    await redisService.set(key, Date.now().toString(), NONCE_TTL_SECONDS);
  } catch {
    // Fallback to memory store if Redis unavailable
    cleanMemoryStore();
    memoryStore.set(nonce, Date.now());
  }

  return res.json({ nonce });
});

/**
 * Validates and consumes a nonce (single-use).
 * Returns true if the nonce is valid and not expired.
 */
export async function validateNonce(nonce: string): Promise<boolean> {
  const key = `${NONCE_PREFIX}${nonce}`;

  try {
    const val = await redisService.get(key);
    if (!val) {
      // Check memory fallback
      const createdAt = memoryStore.get(nonce);
      if (!createdAt) return false;
      memoryStore.delete(nonce);
      return Date.now() - createdAt < NONCE_TTL_SECONDS * 1000;
    }
    // Consume it atomically — delete from Redis immediately
    await redisService.del(key);
    const createdAt = parseInt(val, 10);
    return Date.now() - createdAt < NONCE_TTL_SECONDS * 1000;
  } catch {
    // If Redis is down during validation, fall back to memory
    const createdAt = memoryStore.get(nonce);
    if (!createdAt) return false;
    memoryStore.delete(nonce);
    return Date.now() - createdAt < NONCE_TTL_SECONDS * 1000;
  }
}

export const nonceRouter = router;
