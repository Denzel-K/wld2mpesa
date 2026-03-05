import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// In-memory nonce store (good enough for mini-app scale)
const nonceStore = new Map<string, { nonce: string; createdAt: number }>();

// Clean up nonces older than 5 minutes
function cleanNonces() {
    const now = Date.now();
    for (const [key, val] of nonceStore.entries()) {
        if (now - val.createdAt > 5 * 60 * 1000) {
            nonceStore.delete(key);
        }
    }
}

/**
 * GET /api/nonce
 * Returns a fresh, single-use nonce for walletAuth SIWE
 */
router.get('/', (_req, res) => {
    cleanNonces();
    const nonce = crypto.randomUUID().replace(/-/g, '');
    nonceStore.set(nonce, { nonce, createdAt: Date.now() });
    return res.json({ nonce });
});

/**
 * Validates and consumes a nonce. Returns true if valid.
 */
export function validateNonce(nonce: string): boolean {
    const entry = nonceStore.get(nonce);
    if (!entry) return false;
    // Consume it (one-time use)
    nonceStore.delete(nonce);
    return Date.now() - entry.createdAt < 5 * 60 * 1000;
}

export const nonceRouter = router;
