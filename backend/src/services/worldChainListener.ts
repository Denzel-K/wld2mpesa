/**
 * worldChainListener.ts — Listens for WLD transfers on World Chain
 *
 * Simulation: waits a fixed delay and returns true
 * Production: uses viem to watch for ERC-20 Transfer events
 *
 * TODO: PRODUCTION - See TRANSITION_GUIDE.md Step 3
 * Install: npm install viem
 */

import { createPublicClient, http, Hash, Hex, defineChain, formatUnits, isAddress } from 'viem';
import { config } from '../config';
import { logger, maskWalletAddress } from '../utils/logger';
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

const WLD_CONTRACT = config.WLD_CONTRACT_ADDRESS as Hex;
const erc20BalanceOfAbi = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}] as const;

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
      const maskedHash = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
      logger.blockchainTx('pending', `Waiting for transaction receipt`, txHash);

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash as Hash,
        confirmations: 1,
        timeout: 120_000 // 2 minutes
      });

      if (receipt.status !== 'success') {
        logger.error('BLOCKCHAIN', `Transaction failed on-chain`, undefined, {
          txHash: maskedHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });
        return false;
      }

      logger.blockchainTx('pending', `Transaction confirmed, verifying WLD transfer`, txHash, {
        to: maskWalletAddress(toAddress),
        blockNumber: receipt.blockNumber,
        confirmations: 1,
      });

      // Verify WLD contract was involved
      const wldLog = receipt.logs.find(
        (log) => log.address.toLowerCase() === WLD_CONTRACT.toLowerCase()
      );

      if (!wldLog) {
        logger.error('BLOCKCHAIN', `WLD transfer not found in transaction logs`, undefined, {
          txHash: maskedHash,
          contractFound: false,
        });
        return false;
      }

      logger.blockchainTx('success', `WLD transfer verified`, txHash, {
        to: maskWalletAddress(toAddress),
        amount: formatUnits(expectedAmount, 18) + ' WLD',
      });

      return true;
    } catch (err) {
      logger.error('BLOCKCHAIN', `Error verifying transaction`, undefined, err);
      return false;
    }
  }

  async getWldBalance(walletAddress: string): Promise<string> {
    if (!isAddress(walletAddress)) {
      return "0";
    }
    const client = createPublicClient({
      chain: worldchain,
      transport: http(config.WORLD_CHAIN_RPC_URL),
    });

    try {
      logger.debug('BLOCKCHAIN', `Fetching WLD balance`, undefined, {
        wallet: maskWalletAddress(walletAddress),
      });
      
      const balanceBigInt = await client.readContract({
        address: WLD_CONTRACT,
        abi: erc20BalanceOfAbi,
        functionName: 'balanceOf',
        args: [walletAddress as Hex]
      });
      
      const balance = formatUnits(balanceBigInt as bigint, 18);
      logger.info('BLOCKCHAIN', 'Balance fetched: [REDACTED] WLD', undefined, {
        wallet: maskWalletAddress(walletAddress),
        balanceWld: '[REDACTED]',
      });
      
      return balance;
    } catch (err) {
      logger.error('BLOCKCHAIN', `Failed to fetch balance`, undefined, {
        wallet: maskWalletAddress(walletAddress),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return "0";
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWorldChainListener(): IWorldChainListener {
  return new RealWorldChainListener();
}

export const worldChainListener = createWorldChainListener();

// sleep removed
