/**
 * minikit.ts — MiniKit SDK wrapper
 *
 * Centralises all MiniKit SDK interactions so that:
 * 1. The rest of the app never imports @worldcoin/minikit-js directly
 * 2. We can easily swap implementations (e.g., mock for unit tests)
 * 3. TypeScript types stay consistent
 */

import { MiniKit, tokenToDecimals, Tokens, PayCommandInput } from '@worldcoin/minikit-js';

// @ts-ignore
const APP_ID = (import.meta as any).env?.VITE_WLD_APP_ID ?? 'app_staging_wld2mpesa';

/**
 * Initialise MiniKit. Call this once at app startup (App.tsx).
 */
export function initMiniKit(): void {
  try {
    if (typeof window !== 'undefined') {
      MiniKit.install(APP_ID);
    }
  } catch (error) {
    console.warn('[MiniKit] Installation failed (likely running outside World App)');
  }
}

/**
 * Returns the user's wallet address if running inside World App.
 */
export function getWalletAddress(): string | null {
  try {
    if (!isInsideWorldApp()) return '0xSIMULATED_USER_WALLET';
    // Use any cast to bypass missing type property in some versions of SDK types
    return (MiniKit as any).walletAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the app is running inside World App.
 */
export function isInsideWorldApp(): boolean {
  try {
    return MiniKit.isInstalled();
  } catch {
    return false;
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
 * Send WLD to the backend escrow wallet.
 *
 * @param recipientAddress - Backend wallet that receives WLD
 * @param wldAmount        - Amount in WLD (as a string, e.g. "0.4231")
 * @param referenceId      - Your internal transaction ID (stored on-chain as reference)
 */
export async function payWithMiniKit(
  recipientAddress: string,
  wldAmount: string,
  referenceId: string
): Promise<MiniKitPayResult> {
  if (!isInsideWorldApp()) {
    // Outside World App — simulate success for dev/preview
    console.warn('[MiniKit] Not inside World App — simulating pay() success');
    await sleep(1500);
    return {
      success: true,
      txHash: `0xSIMULATED_${Date.now()}`,
      payload: { simulated: true },
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

/**
 * World ID verification (optional — proves user is a unique human).
 *
 * @param action - The action ID registered in World Developer Portal
 * @param signal - A string signal to bind the proof to (e.g. transaction ID)
 */
export interface WorldIdProof {
  nullifier_hash: string;
  merkle_root: string;
  proof: string;
  verification_level: string;
}

export async function verifyWithWorldId(
  action: string,
  signal: string
): Promise<WorldIdProof | null> {
  if (!isInsideWorldApp()) {
    console.warn('[MiniKit] Not inside World App — simulating verify() success');
    await sleep(1000);
    return {
      nullifier_hash: '0xSIMULATED_NULLIFIER',
      merkle_root: '0xSIMULATED_ROOT',
      proof: '0xSIMULATED_PROOF',
      verification_level: 'orb',
    };
  }

  const { finalPayload } = await MiniKit.commandsAsync.verify({
    action,
    signal,
    verification_level: 'orb' as any,
  });

  if (finalPayload.status === 'error') {
    return null;
  }

  return finalPayload as unknown as WorldIdProof;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
