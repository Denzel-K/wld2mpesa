/**
 * api.ts — Backend API client
 *
 * All HTTP calls to the Express backend go through this module.
 * Centralising them makes it trivial to swap the base URL or add auth headers.
 */

// @ts-ignore
const BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL ?? '/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateData {
  wldPriceKes: number;
  wldPriceUsd: number;
  usdKesRate: number;
  source: string;
  cachedAt: string;
}

export interface InitiatePaymentRequest {
  kesAmount: number;
  transactionType: 'send' | 'paybill' | 'pochi' | 'till';
  tillNumber?: string;
  phoneNumber?: string;
  accountNumber?: string;
  walletAddress: string;
  worldIdProof?: unknown;
}

export interface InitiatePaymentResponse {
  transactionId: string;
  wldAmount: string;
  feeWld: string;
  feeKes: number;
  rate: string;
  expiresAt: string;
  payToAddress: string;
}

export interface ConfirmPaymentRequest {
  transactionId: string;
  txHash: string;
  miniKitPayload: unknown;
}

export interface ConfirmPaymentResponse {
  transactionId: string;
  status: string;
  estimatedSettlementMinutes: number;
}

export interface TransactionStep {
  step: string;
  timestamp: string;
  done: boolean;
}

export interface TransactionStatus {
  transactionId: string;
  status: 'INITIATED' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'OFFRAMP_INITIATED' | 'MPESA_SENT' | 'SETTLED' | 'FAILED';
  kesAmount: number;
  transactionType: 'send' | 'paybill' | 'pochi' | 'till';
  tillNumber?: string | null;
  phoneNumber?: string | null;
  accountNumber?: string | null;
  mpesaReceiptNumber?: string | null;
  settledAt?: string | null;
  failureReason?: string | null;
  steps: TransactionStep[];
}

export interface User {
  id: string;
  walletAddress: string;
  nullifierHash?: string | null;
  name?: string | null;
  isVerified: boolean;
  onboarded: boolean;
  balanceWld?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetch live WLD/KES exchange rate.
 * Simulated: returns hardcoded rate. Production: CoinGecko.
 */
export async function fetchRate(): Promise<RateData> {
  const res = await apiFetch('/rates/wld-kes');
  return res as RateData;
}

/**
 * Initiate a new payment — returns WLD amount + address to pay.
 */
export async function initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
  const res = await apiFetch('/payment/initiate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res as InitiatePaymentResponse;
}

/**
 * Confirm payment after MiniKit pay() completes.
 */
export async function confirmPayment(req: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
  const res = await apiFetch('/payment/confirm', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res as ConfirmPaymentResponse;
}

/**
 * Poll transaction status.
 */
export async function getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
  const res = await apiFetch(`/payment/status/${transactionId}`);
  return res as TransactionStatus;
}

/**
 * Fetch user by wallet address.
 */
export async function fetchUser(walletAddress: string): Promise<User | null> {
  const res = await apiFetch(`/user/${walletAddress}`).catch(err => {
    if (err instanceof ApiError && err.statusCode === 404) return null;
    throw err;
  });
  return res as User | null;
}

/**
 * Sync user (verify world id proof and create/update user).
 */
export async function syncUser(data: { walletAddress: string; worldIdProof?: any; v4Result?: any; rpContext?: any; actionId: string }): Promise<User> {
  const res = await apiFetch('/user/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res as User;
}

/**
 * Fetch World ID 4.0 IDKit context (signed signature).
 */
export async function fetchIdKitContext(actionId: string): Promise<any> {
    const res = await apiFetch('/idkit/rp-context', {
        method: 'POST',
        body: JSON.stringify({ action: actionId }),
    });
    return res;
}

/**
 * Mark user as onboarded.
 */
export async function markOnboarded(walletAddress: string): Promise<void> {
  await apiFetch(`/user/${walletAddress}/onboard`, {
    method: 'POST',
  });
}

/**
 * Fetch transaction history for a wallet.
 */
export async function fetchTransactionHistory(walletAddress: string): Promise<TransactionStatus[]> {
  const res = await apiFetch(`/payment/history/${walletAddress}`);
  return res as TransactionStatus[];
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(
      response.status,
      (errorBody as { error?: string }).error ?? `HTTP ${response.status}`
    );
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
