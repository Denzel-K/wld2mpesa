"use strict";
/**
 * rates.routes.ts — Exchange rate routes
 *
 * GET /api/rates/wld-kes — current WLD/KES rate
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratesRouter = void 0;
const express_1 = require("express");
const rateService_1 = require("../services/rateService");
exports.ratesRouter = (0, express_1.Router)();
/**
 * GET /api/rates/wld-kes
 *
 * Returns current WLD/KES rate.
 * Simulation: returns hardcoded rate with jitter
 * Production: fetches from CoinGecko (cached 60s)
 */
exports.ratesRouter.get('/wld-kes', asyncHandler(async (_req, res) => {
    const rate = await rateService_1.rateService.getWldKesRate();
    res.json(rate);
}));
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
//# sourceMappingURL=rates.routes.js.map