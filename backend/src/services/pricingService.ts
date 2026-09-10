/**
 * Authoritative, server-side pricing for every payout rail.
 *
 * Provider pricing changes and enterprise contracts differ, so values are
 * configured as reserves.  A quote always funds every configured cost plus a
 * positive minimum margin; it must be reconciled against the actual provider
 * debit after settlement.
 */
import { config } from '../config';

export type PaymentRail = 'send' | 'paybill' | 'pochi' | 'till';

export interface FeeQuote {
  pricingVersion: string;
  transactionType: PaymentRail;
  recipientAmountKes: number;
  userServiceFeeKes: number;
  platformFeePercent: number;
  fixedServiceFeeKes: number;
  userRailFeeKes: number;
  totalUserFeeKes: number;
  totalUserPaysKes: number;
  wldAmount: string;
  feeWld: string;
  wldRateKes: number;
  platformCosts: {
    offrampReserveKes: number;
    dexReserveKes: number;
    gasReserveKes: number;
    mpesaRailReserveKes: number;
  };
  minimumMarginKes: number;
  expectedNetMarginKes: number;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Safaricom B2C tariff to registered users (business paid). */
export function b2cRailFee(amount: number): number {
  if (amount <= 100) return 0;
  if (amount <= 1500) return 5;
  if (amount <= 5000) return 9;
  if (amount <= 20000) return 11;
  return 13;
}

function mpesaRailReserve(amount: number, rail: PaymentRail): number {
  if (rail === 'send' || rail === 'pochi') return b2cRailFee(amount);
  // Till / Paybill merchant pricing is contract-specific. Use a configurable,
  // conservative reserve until the direct Daraja quote is recorded.
  const percent = rail === 'till' ? config.MPESA_TILL_RESERVE_PERCENT : config.MPESA_PAYBILL_RESERVE_PERCENT;
  return amount <= 200 ? 0 : Math.min(round(amount * percent / 100), config.MPESA_MERCHANT_RESERVE_CAP_KES);
}

export function quotePayment(amount: number, rail: PaymentRail, wldRateKes: number): FeeQuote {
  const railFee = mpesaRailReserve(amount, rail);
  const platformFeePercent = config.getFeeForAmount(amount);
  const progressiveFeeKes = progressiveServiceFee(amount);
  // Guard the lowest values and any future configuration change: this is a
  // true minimum service fee, not a replacement price for normal transactions.
  const sustainabilityFloorKes = sustainableMinimumServiceFee(amount, railFee);
  const userServiceFeeKes = Math.max(progressiveFeeKes, sustainabilityFloorKes);
  const totalUserFeeKes = round(userServiceFeeKes + railFee);
  const dexReserveKes = round((amount + totalUserFeeKes) * config.DEX_POOL_FEE_PERCENT / 100);
  const offrampReserveKes = round(amount * config.OFFRAMP_RESERVE_PERCENT / 100);
  const userRailFeeKes = railFee;
  const expectedNetMarginKes = round(userServiceFeeKes - dexReserveKes - offrampReserveKes - config.GAS_BUFFER_KES);
  const totalUserPaysKes = round(amount + totalUserFeeKes);

  return {
    pricingVersion: '2026-09-cost-plus-v1', transactionType: rail, recipientAmountKes: amount,
    userServiceFeeKes, platformFeePercent, fixedServiceFeeKes: config.SERVICE_FIXED_FEE_KES,
    userRailFeeKes, totalUserFeeKes, totalUserPaysKes,
    wldAmount: (totalUserPaysKes / wldRateKes).toFixed(6),
    feeWld: (totalUserFeeKes / wldRateKes).toFixed(6), wldRateKes,
    platformCosts: { offrampReserveKes, dexReserveKes, gasReserveKes: config.GAS_BUFFER_KES, mpesaRailReserveKes: railFee },
    minimumMarginKes: config.MINIMUM_MARGIN_KES, expectedNetMarginKes,
  };
}

/** KES 10 fixed service component plus marginal (not cliff) percentage tiers. */
function progressiveServiceFee(amount: number): number {
  let remaining = amount;
  let fee = config.SERVICE_FIXED_FEE_KES;
  const add = (limit: number, percent: number) => {
    const band = Math.min(remaining, limit);
    fee += band * percent / 100;
    remaining -= band;
  };
  add(config.FEE_TIER_1_MAX, config.FEE_TIER_1_PERCENT);
  add(config.FEE_TIER_2_MAX - config.FEE_TIER_1_MAX, config.FEE_TIER_2_PERCENT);
  add(config.FEE_TIER_3_MAX - config.FEE_TIER_2_MAX, config.FEE_TIER_3_PERCENT);
  if (remaining > 0) fee += remaining * config.FEE_TIER_4_PERCENT / 100;
  return round(fee);
}

function sustainableMinimumServiceFee(amount: number, railFee: number): number {
  const dexRate = config.DEX_POOL_FEE_PERCENT / 100;
  return round((
    amount * config.OFFRAMP_RESERVE_PERCENT / 100
    + config.GAS_BUFFER_KES
    + config.MINIMUM_MARGIN_KES
    + dexRate * (amount + railFee)
  ) / (1 - dexRate));
}
