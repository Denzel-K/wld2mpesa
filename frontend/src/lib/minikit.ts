/**
 * minikit.ts — MiniKit SDK wrapper
 *
 * Correct integration pattern per Worldcoin docs (2025):
 * 1. Call walletAuth to get the user's wallet address (required)
 * 2. Call verify to get the World ID proof (for human uniqueness)
 * 3. Backend syncs user with proof
 */

import { MiniKit, tokenToDecimals, VerificationLevel } from '@worldcoin/minikit-js';

const APP_ID = (import.meta as any).env?.VITE_WLD_APP_ID || 'app_ac9f43a974959b04b11b081c3740f932';
const RP_ID = (import.meta as any).env?.VITE_WLD_RP_ID || APP_ID;
const LOGIN_ACTION_ID = (import.meta as any).env?.VITE_WLD_LOGIN_ACTION_ID || 'wld2mpesa-login';
const PAY_ACTION_ID = (import.meta as any).env?.VITE_WLD_PAY_ACTION_ID || 'wld2mpesa-pay';
const BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || '/api';

export { APP_ID, RP_ID, LOGIN_ACTION_ID, PAY_ACTION_ID, BASE_URL };

/**
 * Log an error to the backend so it surfaces in Docker logs.
 * Browser-side console.error is invisible in Docker — this is the workaround.
 */
async function logToServer(level: 'info' | 'warn' | 'error', message: string, context?: object) {
  try {
    await fetch(`${BASE_URL}/debug/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, context }),
    });
  } catch {
    // Ignore — if the backend is unreachable, we can't log anyway
  }
}

// Workaround for broken/missing exports in @worldcoin/minikit-js@1.11.0 types
export enum Tokens {
  WLD = 'WLD',
  USDC = 'USDCE',
}

export enum Network {
  Optimism = 'optimism',
  WorldChain = 'worldchain',
}

export interface TokensPayload {
  symbol: Tokens;
  token_amount: string;
}

export interface PayCommandInput {
  reference: string;
  to: `0x${string}` | string;
  tokens: TokensPayload[];
  network?: Network;
  description: string;
}

/**
 * Initialise MiniKit. Call once at app startup.
 */
export function initMiniKit(): void {
  try {
    if (typeof window !== 'undefined') {
      MiniKit.install(APP_ID);
      logToServer('info', `MiniKit installed. App ID: ${APP_ID}, BASE_URL: ${BASE_URL}`);
    }
  } catch (error) {
    logToServer('warn', 'MiniKit installation failed', { error: String(error) });
    console.warn('[MiniKit] Installation failed (likely running outside World App):', error);
  }
}

/**
 * Test if the backend is reachable via the Vite proxy.
 * Useful for diagnosing network issues before attempting walletAuth.
 */
export async function checkBackend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network error' };
  }
}

/**
 * Returns true if the app is running inside World App with MiniKit available.
 */
export function isInsideWorldApp(): boolean {
  try {
    return MiniKit.isInstalled();
  } catch {
    return false;
  }
}

export interface WorldIdProof {
  nullifier_hash: string;
  merkle_root: string;
  proof: string;
  verification_level: string;
}

export interface WalletAuthResult {
  success: boolean;
  walletAddress?: string;
  error?: string;
  payload?: unknown;
}

/**
 * Step 1: Authenticate wallet using SIWE (Sign-In with Ethereum).
 * This is the ONLY way to get the user's wallet address from MiniKit.
 *
 * Returns the wallet address on success.
 */
export async function authenticateWallet(): Promise<WalletAuthResult> {
  if (!isInsideWorldApp()) {
    return {
      success: false,
      error: 'Not running inside World App. Please open this app from World App to proceed.',
    };
  }

  try {
    // 1. Fetch nonce from backend
    const nonceRes = await fetch(`${BASE_URL}/nonce`);
    if (!nonceRes.ok) {
      throw new Error(`Failed to get nonce: ${nonceRes.status}`);
    }
    const { nonce } = await nonceRes.json();

    // 2. Call walletAuth command on MiniKit
    const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
      nonce,
      requestId: '0',
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
      statement: 'Sign in to WLD2Mpesa to enable WLD-to-M-Pesa transfers.',
    });

    if (finalPayload.status === 'error') {
      return {
        success: false,
        error: 'Wallet authentication was declined',
        payload: finalPayload,
      };
    }

    const successPayload = finalPayload as { status: 'success'; address: string };

    // 3. Confirm with backend
    const siweRes = await fetch(`${BASE_URL}/user/complete-siwe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: finalPayload, nonce }),
    });

    if (!siweRes.ok) {
      const err = await siweRes.json().catch(() => ({ error: 'SIWE confirmation failed' }));
      throw new Error(err.error || 'SIWE verification failed');
    }

    return {
      success: true,
      walletAddress: successPayload.address,
      payload: finalPayload,
    };
  } catch (err: any) {
    const errMsg = err.message || 'Wallet authentication failed';
    console.error('[MiniKit] walletAuth error:', err);
    logToServer('error', '[MiniKit] walletAuth error', { message: errMsg, stack: err.stack });
    return { success: false, error: errMsg };
  }
}

/**
 * Step 2: World ID verification — proves user is a unique human.
 * Must be called AFTER authenticateWallet() to have a wallet address.
 *
 * @param action - The action ID registered in World Developer Portal
 * @param signal - Typically the user's wallet address
 */
export async function verifyWithWorldId(
  action: string,
  signal: string,
  rpContext?: any
): Promise<any | null> {
  if (!isInsideWorldApp()) {
    console.error('[MiniKit] Not inside World App — cannot verify World ID');
    return null;
  }

  try {
    const { finalPayload } = await (MiniKit.commandsAsync.verify as any)({
      action,
      signal,
      verification_level: VerificationLevel.Orb,
      ...rpContext, // Spread the context directly (rp_id, nonce, signature, etc.)
    });

    if (finalPayload.status === 'error') {
      console.error('[MiniKit] verify error:', finalPayload);
      logToServer('error', '[MiniKit] verify error', { payload: finalPayload });
      return null;
    }

    // Return the full payload for v4 pass-through
    return finalPayload;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[MiniKit] verify exception:', err);
    logToServer('error', '[MiniKit] verify exception', { message: errMsg });
    return null;
  }
}

/**
 * The result shape returned by MiniKit pay().
 */
export interface MiniKitPayResult {
  success: boolean;
  txHash?: string;
  payload?: unknown;
  error?: string;
}

/**
 * Send WLD to the backend escrow wallet via MiniKit payment.
 */
export async function payWithMiniKit(
  recipientAddress: string,
  wldAmount: string,
  referenceId: string
): Promise<MiniKitPayResult> {
  if (!isInsideWorldApp()) {
    return {
      success: false,
      error: 'Not running inside World App. Please open this app from World App to make payments.',
    };
  }

  const payload: PayCommandInput = {
    reference: referenceId,
    to: recipientAddress,
    tokens: [
      {
        symbol: Tokens.WLD,
        token_amount: tokenToDecimals(parseFloat(wldAmount), Tokens.WLD).toString(),
      },
    ],
    description: `WLD2Mpesa payment — ref ${referenceId}`,
  };

  const { commandPayload, finalPayload } = await MiniKit.commandsAsync.pay(payload);

  if (finalPayload.status === 'error') {
    return {
      success: false,
      error: (finalPayload as { error_code?: string }).error_code ?? 'UNKNOWN_ERROR',
      payload: finalPayload,
    };
  }

  return {
    success: true,
    txHash: (finalPayload as { transaction_id?: string }).transaction_id,
    payload: { commandPayload, finalPayload },
  };
}

