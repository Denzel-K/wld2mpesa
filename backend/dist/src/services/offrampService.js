"use strict";
/**
 * offrampService.ts — WLD → KES off-ramp service
 *
 * This service acts as a thin wrapper around the BitnobService.
 * All Bitnob-specific logic has been moved to bitnobService.ts for better
 * maintainability and separation of concerns.
 *
 * @see bitnobService.ts for the full Bitnob API implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitnobService = exports.bitnobService = exports.offrampService = void 0;
exports.createOfframpService = createOfframpService;
const bitnobService_1 = require("./bitnobService");
Object.defineProperty(exports, "bitnobService", { enumerable: true, get: function () { return bitnobService_1.bitnobService; } });
Object.defineProperty(exports, "BitnobService", { enumerable: true, get: function () { return bitnobService_1.BitnobService; } });
/**
 * OfframpService — Delegates to BitnobService
 *
 * This wrapper maintains backward compatibility while using
 * the new comprehensive Bitnob API implementation.
 */
class OfframpService {
    constructor() {
        this.bitnob = bitnobService_1.bitnobService;
    }
    async initiateSwap(wldAmount, kesAmount, txnId) {
        console.log(`[OfframpService] Initiating Bitnob off-ramp for txn ${txnId}: ${wldAmount} WLD -> ${kesAmount} KES`);
        return this.bitnob.initiateSwap(wldAmount, kesAmount, txnId);
    }
    async checkSwapStatus(swapId) {
        return this.bitnob.checkSwapStatus(swapId);
    }
}
// ─── Factory ──────────────────────────────────────────────────────────────────
function createOfframpService() {
    return new OfframpService();
}
// Export singleton instance (backward compatible)
exports.offrampService = createOfframpService();
//# sourceMappingURL=offrampService.js.map