/**
 * utils.ts — Shared helper utilities
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format currency amount */
export function formatCurrency(amount: number, currency: string = 'KES'): string {
  const symbols: Record<string, string> = {
    KES: 'KSh',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    ZAR: 'R',
    NGN: '₦',
    UGX: 'USh',
    TZS: 'TSh',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'KES' ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Legacy support - redirected to formatCurrency */
export function formatKes(amount: number): string {
  return formatCurrency(amount, 'KES');
}

/** Format WLD amount: 0.42314 → "0.4231 WLD" */
export function formatWld(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${n.toFixed(4)} WLD`;
}

/** Shorten transaction ID for display */
export function shortTxId(txId: string): string {
  if (txId.length <= 12) return txId;
  return `${txId.slice(0, 8)}...${txId.slice(-4)}`;
}

/** Convert KES to target currency using base USD rate */
export function convertKesTo(kesAmount: number, targetCurrency: string, usdKesRate: number = 135): number {
  if (!targetCurrency || targetCurrency === 'KES') return kesAmount;
  
  // Real-ish conversion using common mid-market rates as fallback
  // if not USD/EUR which we often have live.
  const ratesToUsd: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 151,
    ZAR: 19,
    NGN: 1400,
    UGX: 3800,
    TZS: 2500,
  };
  
  const usdAmount = kesAmount / usdKesRate;
  const targetRate = ratesToUsd[targetCurrency] || 1;
  return usdAmount * targetRate;
}

/** Get Safaricom M-Pesa transaction fees for sending money (2024/2025 table) */
export function getMpesaFees(amount: number): number {
  if (amount <= 100) return 0;
  if (amount <= 500) return 7;
  if (amount <= 1000) return 13;
  if (amount <= 1500) return 23;
  if (amount <= 2500) return 33;
  if (amount <= 3500) return 53;
  if (amount <= 5000) return 57;
  if (amount <= 7500) return 78;
  if (amount <= 10000) return 90;
  if (amount <= 15000) return 100;
  if (amount <= 20000) return 105;
  return 108; // For amounts above 20,000 up to 250,000
}

/** 
 * Tiered platform fee structure — must match backend config
 * Tier 1: 3% for KES 10 - 5,000
 * Tier 2: 2% for KES 5,001 - 20,000
 * Tier 3: 1.5% for KES 20,001+
 */
export const FEE_TIER_1_PERCENT = 3;
export const FEE_TIER_2_PERCENT = 2;
export const FEE_TIER_3_PERCENT = 1.5;
export const FEE_TIER_1_MAX = 5000;
export const FEE_TIER_2_MAX = 20000;

/** Legacy constant for backward compatibility - use getFeeForAmount() instead */
export const PLATFORM_FEE_PERCENT = FEE_TIER_1_PERCENT;

/** Gas buffer in KES absorbed into fee — covers World Chain L2 ETH gas for DEX swap */
export const GAS_BUFFER_KES = 10;

/** Get the appropriate fee percentage for a given KES amount */
export function getFeeForAmount(kesAmount: number): number {
  if (kesAmount <= FEE_TIER_1_MAX) {
    return FEE_TIER_1_PERCENT;
  } else if (kesAmount <= FEE_TIER_2_MAX) {
    return FEE_TIER_2_PERCENT;
  } else {
    return FEE_TIER_3_PERCENT;
  }
}

/** 
 * Calculate WLD amount from KES, rate, and fee
 * Uses tiered fee structure based on amount
 */
export function calculateWldAmount(
  kesAmount: number,
  wldPriceKes: number,
  feePercent?: number,
  gasBufferKes: number = GAS_BUFFER_KES
): { wldAmount: number; feeKes: number; safaricomFee: number; ourFee: number; feeWld: number; netKes: number; gasBuffer: number; feePercent: number } {
  const effectiveFeePercent = feePercent ?? getFeeForAmount(kesAmount);
  const ourFee = parseFloat(((kesAmount * effectiveFeePercent) / 100).toFixed(2));
  const safaricomFee = getMpesaFees(kesAmount);
  const feeKes = parseFloat((ourFee + safaricomFee + gasBufferKes).toFixed(2));
  const netKes = kesAmount + feeKes;
  const wldAmount = netKes / wldPriceKes;
  const feeWld = feeKes / wldPriceKes;
  return { wldAmount, feeKes, safaricomFee, ourFee, feeWld, netKes, gasBuffer: gasBufferKes, feePercent: effectiveFeePercent };
}

/** Format relative time: "2 minutes ago" */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Validate M-Pesa Till number (5–6 digits) */
export function isValidTillNumber(till: string): boolean {
  return /^\d{5,6}$/.test(till.trim());
}

/** Validate KES amount within allowed range */
export function isValidKesAmount(amount: number, min = 10, max = 150000): boolean {
  return !isNaN(amount) && amount >= min && amount <= max;
}

/** Generate a nonce for World ID */
export function generateNonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
