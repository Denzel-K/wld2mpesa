/**
 * utils.ts — Shared helper utilities
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format currency amount: (1000, 'KES') → "KSh 1,000" */
export function formatCurrency(amount: number, currency: string = 'KES'): string {
  if (currency === 'KES') {
    return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    YEN: '¥',
  };
  return `${symbols[currency] || currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
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

/** Fixed rates for demo/simulation */
const DEMO_RATES: Record<string, number> = {
  USD: 129.20,
  EUR: 150.30,
  YEN: 0.83,
};

/** Convert KES to target currency */
export function convertKesTo(kesAmount: number, targetCurrency: string): number {
  if (targetCurrency === 'KES') return kesAmount;
  const rate = DEMO_RATES[targetCurrency] || 1;
  return kesAmount / rate;
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

/** Calculate WLD amount from KES, rate, and fee */
export function calculateWldAmount(
  kesAmount: number,
  wldPriceKes: number,
  feePercent: number = 0.5
): { wldAmount: number; feeKes: number; safaricomFee: number; ourFee: number; feeWld: number; netKes: number } {
  const ourFee = (kesAmount * feePercent) / 100;
  const safaricomFee = getMpesaFees(kesAmount);
  const feeKes = ourFee + safaricomFee;
  const netKes = kesAmount + feeKes; // user pays total = amount + fees
  const wldAmount = netKes / wldPriceKes;
  const feeWld = feeKes / wldPriceKes;
  return { wldAmount, feeKes, safaricomFee, ourFee, feeWld, netKes };
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

/** Sleep utility for simulations */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
