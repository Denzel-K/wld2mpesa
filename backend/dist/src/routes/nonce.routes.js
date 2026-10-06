"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nonceRouter = void 0;
exports.validateNonce = validateNonce;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// In-memory nonce store (good enough for mini-app scale)
const nonceStore = new Map();
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
    const nonce = crypto_1.default.randomUUID().replace(/-/g, '');
    nonceStore.set(nonce, { nonce, createdAt: Date.now() });
    return res.json({ nonce });
});
/**
 * Validates and consumes a nonce. Returns true if valid.
 */
function validateNonce(nonce) {
    const entry = nonceStore.get(nonce);
    if (!entry)
        return false;
    // Consume it (one-time use)
    nonceStore.delete(nonce);
    return Date.now() - entry.createdAt < 5 * 60 * 1000;
}
exports.nonceRouter = router;
//# sourceMappingURL=nonce.routes.js.map