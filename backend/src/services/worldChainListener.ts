/**
 * worldChainListener.ts — Listens for WLD transfers on World Chain
 *
 * Uses viem to watch for ERC-20 Transfer events on World Chain
 */

import { createPublicClient, http, Hash, Hex, defineChain, formatUnits, isAddress, decodeEventLog } from 'viem';
import { config } from '../config';
import { logger, maskWalletAddress } from '../utils/logger';
import type { IWorldChainListener } from '../types';

// Amount tolerance: 2% to handle MiniKit rounding differences
const AMOUNT_TOLERANCE_PERCENT = 2;

// Multiple RPC endpoints for fallback
const RPC_ENDPOINTS = [
  config.WORLD_CHAIN_RPC_URL,
  'https://worldchain-mainnet.g.alchemy.com/public',
  'https://worldchain-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura key
];

// ERC20 Transfer event signature
const TRANSFER_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: false, name: 'value', type: 'uint256' },
  ],
  name: 'Transfer',
  type: 'event',
} as const;

// World Chain Configuration (L2)
const worldchain = defineChain({
  id: 480,
  name: 'World Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_ENDPOINTS[0]] },
    fallback: { http: RPC_ENDPOINTS.slice(1) },
  },
  blockExplorers: {
    default: { name: 'WorldScan', url: 'https://worldscan.org' },
  },
});

const WLD_CONTRACT = config.WLD_CONTRACT_ADDRESS as Hex;
const erc20BalanceOfAbi = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}] as const;

// ─── World Chain Listener Implementation ──────────────────────────────────────

class WorldChainListener implements IWorldChainListener {
  private async createClientWithFallback(): Promise<ReturnType<typeof createPublicClient>> {
    // Try each RPC endpoint until one works
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      const rpcUrl = RPC_ENDPOINTS[i];
      try {
        const client = createPublicClient({
          chain: worldchain,
          transport: http(rpcUrl, { timeout: 30_000 }),
        });
        // Test the connection
        await client.getChainId();
        logger.info('BLOCKCHAIN', `Connected to World Chain via RPC ${i + 1}/${RPC_ENDPOINTS.length}`);
        return client;
      } catch (err) {
        logger.warn('BLOCKCHAIN', `RPC ${i + 1} failed, trying fallback`, undefined, {
          rpc: rpcUrl.slice(0, 30) + '...',
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }
    throw new Error('All RPC endpoints failed');
  }

  private async waitForReceiptWithRetry(
    client: ReturnType<typeof createPublicClient>,
    txHash: Hash,
    maxRetries = 3
  ): Promise<Awaited<ReturnType<typeof client.waitForTransactionReceipt>>> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
          timeout: 300_000, // 5 minutes per attempt
        });
        return receipt;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        logger.warn('BLOCKCHAIN', `Receipt wait attempt ${attempt}/${maxRetries} failed`, undefined, {
          error: lastError.message,
        });
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30_000); // Exponential backoff, max 30s
          logger.info('BLOCKCHAIN', `Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to get receipt after retries');
  }

  private isAmountWithinTolerance(actualAmount: bigint, expectedAmount: bigint): boolean {
    // Calculate 2% tolerance
    const tolerance = (expectedAmount * BigInt(AMOUNT_TOLERANCE_PERCENT)) / BigInt(100);
    const minAcceptable = expectedAmount - tolerance;
    const maxAcceptable = expectedAmount + tolerance;
    
    return actualAmount >= minAcceptable && actualAmount <= maxAcceptable;
  }

  async waitForWldTransfer(
    toAddress: string,
    expectedAmount: bigint,
    txHash: string
  ): Promise<boolean> {
    try {
      const maskedHash = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
      logger.blockchainTx('pending', `Waiting for transaction receipt`, txHash);

      // Create client with RPC fallback
      const client = await this.createClientWithFallback();

      // Wait for receipt with retry
      const receipt = await this.waitForReceiptWithRetry(client, txHash as Hash);

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

      // Find and verify WLD transfer log with amount tolerance
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

      // Decode the transfer event to get the actual amount
      try {
        const decoded = decodeEventLog({
          abi: [TRANSFER_EVENT_ABI],
          data: wldLog.data,
          topics: wldLog.topics,
        });

        if (decoded.eventName === 'Transfer') {
          const actualAmount = decoded.args.value as bigint;
          const isMatch = this.isAmountWithinTolerance(actualAmount, expectedAmount);
          
          if (!isMatch) {
            logger.error('BLOCKCHAIN', `Amount mismatch (with ${AMOUNT_TOLERANCE_PERCENT}% tolerance)`, undefined, {
              txHash: maskedHash,
              expected: formatUnits(expectedAmount, 18) + ' WLD',
              actual: formatUnits(actualAmount, 18) + ' WLD',
              tolerance: `${AMOUNT_TOLERANCE_PERCENT}%`,
            });
            return false;
          }

          logger.blockchainTx('success', `WLD transfer verified`, txHash, {
            to: maskWalletAddress(toAddress),
            amount: formatUnits(actualAmount, 18) + ' WLD',
            expected: formatUnits(expectedAmount, 18) + ' WLD',
            tolerance: `${AMOUNT_TOLERANCE_PERCENT}%`,
          });
        }
      } catch (decodeErr) {
        // If decoding fails, fall back to just checking contract presence
        logger.warn('BLOCKCHAIN', `Could not decode transfer amount, checking contract only`, undefined, {
          error: decodeErr instanceof Error ? decodeErr.message : 'Unknown',
        });
      }

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
    
    try {
      const client = await this.createClientWithFallback();

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
  return new WorldChainListener();
}

export const worldChainListener = createWorldChainListener();
