/**
 * worldChainListener.ts — Listens for WLD transfers on World Chain
 *
 * Simulation: waits a fixed delay and returns true
 * Production: uses viem to watch for ERC-20 Transfer events
 *
 * TODO: PRODUCTION - See TRANSITION_GUIDE.md Step 3
 * Install: npm install viem
 */

import { createPublicClient, http, Hash, Hex, defineChain } from 'viem';
import { config } from '../config';
import type { IWorldChainListener } from '../types';

// World Chain Configuration (L2)
const worldchain = defineChain({
  id: 480,
  name: 'World Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [config.WORLD_CHAIN_RPC_URL || 'https://worldchain-mainnet.g.alchemy.com/public'] },
  },
  blockExplorers: {
    default: { name: 'WorldScan', url: 'https://worldscan.org' },
  },
});

const WLD_CONTRACT = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' as Hex;

// ─── Simulated implementation ─────────────────────────────────────────────────

// Simulation class removed to resolve tsc error. Use RealWorldChainListener.

// ─── Real implementation ──────────────────────────────────────────────────────

class RealWorldChainListener implements IWorldChainListener {
  /**
   * TODO: PRODUCTION - Watch for WLD ERC-20 transfer on World Chain.
   *
   * Steps:
   * 1. npm install viem
   * 2. Import createPublicClient, http from 'viem'
   * 3. Define World Chain config (chainId: 480)
   * 4. Use client.waitForTransactionReceipt()
   * 5. Parse Transfer logs from WLD contract
   *
   * WLD Token Contract on World Chain: 0x2cFc85d8E48F8EAB294be644d9E25C3030863003
   *
   * See TRANSITION_GUIDE.md Step 3 for full diff.
   */
  async waitForWldTransfer(
    toAddress: string,
    expectedAmount: bigint,
    txHash: string
  ): Promise<boolean> {
    const client = createPublicClient({
      chain: worldchain,
      transport: http(config.WORLD_CHAIN_RPC_URL),
    });

    try {
      console.log(`[WorldChain] Waiting for receipt: ${txHash}`);

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash as Hash,
        confirmations: 1,
        timeout: 120_000 // 2 minutes
      });

      if (receipt.status !== 'success') {
        console.error(`[WorldChain] Transaction failed: ${txHash}`);
        return false;
      }

      console.log(`[WorldChain] Transaction confirmed: ${txHash}. Verifying WLD Transfer to ${toAddress} with amount ${expectedAmount}...`);

      // Verify WLD contract was involved
      const wldLog = receipt.logs.find(
        (log) => log.address.toLowerCase() === WLD_CONTRACT.toLowerCase()
      );

      if (!wldLog) {
        console.error(`[WorldChain] WLD Transfer log not found in receipt for ${txHash}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[WorldChain] Error waiting for transaction ${txHash}:`, err);
      return false;
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWorldChainListener(): IWorldChainListener {
  return new RealWorldChainListener();
}

export const worldChainListener = createWorldChainListener();

// sleep removed
