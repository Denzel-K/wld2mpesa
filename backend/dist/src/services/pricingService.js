"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.b2cRailFee = b2cRailFee;
exports.quotePayment = quotePayment;
/**
 * Authoritative, server-side pricing for every payout rail.
 *
 * Provider pricing changes and enterprise contracts differ, so values are
 * configured as reserves.  A quote always funds every configured cost plus a
 * positive minimum margin; it must be reconciled against the actual provider
 * debit after settlement.
 */
const config_1 = require("../config");
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Safaricom B2C tariff to registered users (business paid). */
function b2cRailFee(amount) {
    if (amount <= 100)
        return 0;
    if (amount <= 1500)
        return 5;
    if (amount <= 5000)
        return 9;
    if (amount <= 20000)
        return 11;
    return 13;
}
function mpesaRailReserve(amount, rail) {
    if (rail === 'send' || rail === 'pochi')
        return b2cRailFee(amount);
    // Till / Paybill merchant pricing is contract-specific. Use a configurable,
    // conservative reserve until the direct Daraja quote is recorded.
    const percent = rail === 'till' ? config_1.config.MPESA_TILL_RESERVE_PERCENT : config_1.config.MPESA_PAYBILL_RESERVE_PERCENT;
    return amount <= 200 ? 0 : Math.min(round(amount * percent / 100), config_1.config.MPESA_MERCHANT_RESERVE_CAP_KES);
}
function quotePayment(amount, rail, wldRateKes) {
    const railFee = mpesaRailReserve(amount, rail);
    const platformFeePercent = config_1.config.getFeeForAmount(amount);
    const progressiveFeeKes = progressiveServiceFee(amount);
    // Guard the lowest values and any future configuration change: this is a
    // true minimum service fee, not a replacement price for normal transactions.
    const sustainabilityFloorKes = sustainableMinimumServiceFee(amount, railFee);
    const userServiceFeeKes = Math.max(progressiveFeeKes, sustainabilityFloorKes);
    const totalUserFeeKes = round(userServiceFeeKes + railFee);
    const dexReserveKes = round((amount + totalUserFeeKes) * config_1.config.DEX_POOL_FEE_PERCENT / 100);
    const offrampReserveKes = round(amount * config_1.config.OFFRAMP_RESERVE_PERCENT / 100);
    const userRailFeeKes = railFee;
    const expectedNetMarginKes = round(userServiceFeeKes - dexReserveKes - offrampReserveKes);
    const totalUserPaysKes = round(amount + totalUserFeeKes);
    return {
        pricingVersion: '2026-09-cost-plus-v1', transactionType: rail, recipientAmountKes: amount,
        userServiceFeeKes, platformFeePercent, fixedServiceFeeKes: config_1.config.SERVICE_FIXED_FEE_KES,
        userRailFeeKes, totalUserFeeKes, totalUserPaysKes,
        wldAmount: (totalUserPaysKes / wldRateKes).toFixed(6),
        feeWld: (totalUserFeeKes / wldRateKes).toFixed(6), wldRateKes,
        platformCosts: { offrampReserveKes, dexReserveKes, gasReserveKes: config_1.config.GAS_BUFFER_KES, mpesaRailReserveKes: railFee },
        minimumMarginKes: config_1.config.MINIMUM_MARGIN_KES, expectedNetMarginKes,
    };
}
/** KES 10 fixed service component plus marginal (not cliff) percentage tiers. */
function progressiveServiceFee(amount) {
    let remaining = amount;
    let fee = config_1.config.SERVICE_FIXED_FEE_KES;
    const add = (limit, percent) => {
        const band = Math.min(remaining, limit);
        fee += band * percent / 100;
        remaining -= band;
    };
    add(config_1.config.FEE_TIER_1_MAX, config_1.config.FEE_TIER_1_PERCENT);
    add(config_1.config.FEE_TIER_2_MAX - config_1.config.FEE_TIER_1_MAX, config_1.config.FEE_TIER_2_PERCENT);
    add(config_1.config.FEE_TIER_3_MAX - config_1.config.FEE_TIER_2_MAX, config_1.config.FEE_TIER_3_PERCENT);
    if (remaining > 0)
        fee += remaining * config_1.config.FEE_TIER_4_PERCENT / 100;
    return round(fee);
}
function sustainableMinimumServiceFee(amount, railFee) {
    const dexRate = config_1.config.DEX_POOL_FEE_PERCENT / 100;
    return round((amount * config_1.config.OFFRAMP_RESERVE_PERCENT / 100
        + config_1.config.MINIMUM_MARGIN_KES
        + dexRate * (amount + railFee)) / (1 - dexRate));
}
//# sourceMappingURL=pricingService.js.map