"use strict";
/**
 * worldChainListener.ts — Listens for WLD transfers on World Chain
 *
 * Uses viem to watch for ERC-20 Transfer events on World Chain
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldChainListener = void 0;
exports.createWorldChainListener = createWorldChainListener;
const viem_1 = require("viem");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
// Amount tolerance: 2% to handle MiniKit rounding differences
const AMOUNT_TOLERANCE_PERCENT = 2;
// Multiple RPC endpoints for fallback
const RPC_ENDPOINTS = [
    config_1.config.WORLD_CHAIN_RPC_URL,
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
};
// World Chain Configuration (L2)
const worldchain = (0, viem_1.defineChain)({
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
const WLD_CONTRACT = config_1.config.WLD_CONTRACT_ADDRESS;
const erc20BalanceOfAbi = [{ "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" }];
// ─── World Chain Listener Implementation ──────────────────────────────────────
class WorldChainListener {
    async createClientWithFallback() {
        // Try each RPC endpoint until one works
        for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
            const rpcUrl = RPC_ENDPOINTS[i];
            try {
                const client = (0, viem_1.createPublicClient)({
                    chain: worldchain,
                    transport: (0, viem_1.http)(rpcUrl, { timeout: 30000 }),
                });
                // Test the connection
                await client.getChainId();
                logger_1.logger.info('BLOCKCHAIN', `Connected to World Chain via RPC ${i + 1}/${RPC_ENDPOINTS.length}`);
                return client;
            }
            catch (err) {
                logger_1.logger.warn('BLOCKCHAIN', `RPC ${i + 1} failed, trying fallback`, undefined, {
                    rpc: rpcUrl.slice(0, 30) + '...',
                    error: err instanceof Error ? err.message : 'Unknown',
                });
            }
        }
        throw new Error('All RPC endpoints failed');
    }
    async waitForReceiptWithRetry(client, txHash, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const receipt = await client.waitForTransactionReceipt({
                    hash: txHash,
                    confirmations: 1,
                    timeout: 300000, // 5 minutes per attempt
                });
                return receipt;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error('Unknown error');
                logger_1.logger.warn('BLOCKCHAIN', `Receipt wait attempt ${attempt}/${maxRetries} failed`, undefined, {
                    error: lastError.message,
                });
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
                    logger_1.logger.info('BLOCKCHAIN', `Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error('Failed to get receipt after retries');
    }
    isAmountWithinTolerance(actualAmount, expectedAmount) {
        // Calculate 2% tolerance
        const tolerance = (expectedAmount * BigInt(AMOUNT_TOLERANCE_PERCENT)) / BigInt(100);
        const minAcceptable = expectedAmount - tolerance;
        const maxAcceptable = expectedAmount + tolerance;
        return actualAmount >= minAcceptable && actualAmount <= maxAcceptable;
    }
    async waitForWldTransfer(toAddress, expectedAmount, txHash) {
        try {
            const maskedHash = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
            logger_1.logger.blockchainTx('pending', `Waiting for transaction receipt`, txHash);
            // Create client with RPC fallback
            const client = await this.createClientWithFallback();
            // Wait for receipt with retry
            const receipt = await this.waitForReceiptWithRetry(client, txHash);
            if (receipt.status !== 'success') {
                logger_1.logger.error('BLOCKCHAIN', `Transaction failed on-chain`, undefined, {
                    txHash: maskedHash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                });
                return false;
            }
            logger_1.logger.blockchainTx('pending', `Transaction confirmed, verifying WLD transfer`, txHash, {
                to: (0, logger_1.maskWalletAddress)(toAddress),
                blockNumber: receipt.blockNumber,
                confirmations: 1,
            });
            // Find and verify WLD transfer log with amount tolerance
            const wldLog = receipt.logs.find((log) => log.address.toLowerCase() === WLD_CONTRACT.toLowerCase());
            if (!wldLog) {
                logger_1.logger.error('BLOCKCHAIN', `WLD transfer not found in transaction logs`, undefined, {
                    txHash: maskedHash,
                    contractFound: false,
                });
                return false;
            }
            // Decode the transfer event to get the actual amount
            try {
                const decoded = (0, viem_1.decodeEventLog)({
                    abi: [TRANSFER_EVENT_ABI],
                    data: wldLog.data,
                    topics: wldLog.topics,
                });
                if (decoded.eventName === 'Transfer') {
                    const actualAmount = decoded.args.value;
                    const isMatch = this.isAmountWithinTolerance(actualAmount, expectedAmount);
                    if (!isMatch) {
                        logger_1.logger.error('BLOCKCHAIN', `Amount mismatch (with ${AMOUNT_TOLERANCE_PERCENT}% tolerance)`, undefined, {
                            txHash: maskedHash,
                            expected: (0, viem_1.formatUnits)(expectedAmount, 18) + ' WLD',
                            actual: (0, viem_1.formatUnits)(actualAmount, 18) + ' WLD',
                            tolerance: `${AMOUNT_TOLERANCE_PERCENT}%`,
                        });
                        return false;
                    }
                    logger_1.logger.blockchainTx('success', `WLD transfer verified`, txHash, {
                        to: (0, logger_1.maskWalletAddress)(toAddress),
                        amount: (0, viem_1.formatUnits)(actualAmount, 18) + ' WLD',
                        expected: (0, viem_1.formatUnits)(expectedAmount, 18) + ' WLD',
                        tolerance: `${AMOUNT_TOLERANCE_PERCENT}%`,
                    });
                }
            }
            catch (decodeErr) {
                // If decoding fails, fall back to just checking contract presence
                logger_1.logger.warn('BLOCKCHAIN', `Could not decode transfer amount, checking contract only`, undefined, {
                    error: decodeErr instanceof Error ? decodeErr.message : 'Unknown',
                });
            }
            return true;
        }
        catch (err) {
            logger_1.logger.error('BLOCKCHAIN', `Error verifying transaction`, undefined, err);
            return false;
        }
    }
    async getWldBalance(walletAddress) {
        if (!(0, viem_1.isAddress)(walletAddress)) {
            return "0";
        }
        try {
            const client = await this.createClientWithFallback();
            logger_1.logger.debug('BLOCKCHAIN', `Fetching WLD balance`, undefined, {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
            });
            const balanceBigInt = await client.readContract({
                address: WLD_CONTRACT,
                abi: erc20BalanceOfAbi,
                functionName: 'balanceOf',
                args: [walletAddress]
            });
            const balance = (0, viem_1.formatUnits)(balanceBigInt, 18);
            logger_1.logger.info('BLOCKCHAIN', 'Balance fetched: [REDACTED] WLD', undefined, {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                balanceWld: '[REDACTED]',
            });
            return balance;
        }
        catch (err) {
            logger_1.logger.error('BLOCKCHAIN', `Failed to fetch balance`, undefined, {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                error: err instanceof Error ? err.message : 'Unknown error',
            });
            return "0";
        }
    }
}
// ─── Factory ──────────────────────────────────────────────────────────────────
function createWorldChainListener() {
    return new WorldChainListener();
}
exports.worldChainListener = createWorldChainListener();
//# sourceMappingURL=worldChainListener.js.map