"use strict";
/**
 * swapService.ts — Automated DEX Rebalancing (WLD → USDC) on World Chain
 *
 * Uses Uniswap V3 Universal Router
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapService = exports.SwapService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
// Minimal ABIs
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function balanceOf(address account) public view returns (uint256)',
];
const ROUTER_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
];
class SwapService {
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.WORLD_CHAIN_RPC_URL);
        if (!config_1.config.ADMIN_PRIVATE_KEY) {
            throw new Error('ADMIN_PRIVATE_KEY missing from environment');
        }
        this.wallet = new ethers_1.ethers.Wallet(config_1.config.ADMIN_PRIVATE_KEY, this.provider);
    }
    /**
     * Swaps WLD for USDC on World Chain Uniswap V3
     * @param amountWld String representation of WLD amount (e.g. "1.5")
     */
    async swapWldForUsdc(amountWld) {
        const operationId = `swap-${Date.now()}`;
        logger_1.logger.dexOperation(operationId, 'Starting swap', amountWld, 'WLD');
        try {
            const wldContract = new ethers_1.ethers.Contract(config_1.config.WLD_TOKEN, ERC20_ABI, this.wallet);
            const routerContract = new ethers_1.ethers.Contract(config_1.config.UNISWAP_V3_ROUTER, ROUTER_ABI, this.wallet);
            const amountIn = ethers_1.ethers.parseUnits(amountWld, 18);
            // 1. Approve router to spend WLD
            logger_1.logger.dexOperation(operationId, 'Approving router to spend WLD', amountWld, 'WLD');
            const approveTx = await wldContract.approve(config_1.config.UNISWAP_V3_ROUTER, amountIn);
            logger_1.logger.debug('DEX', `Approval tx sent: ${approveTx.hash.slice(0, 10)}...`, operationId);
            await approveTx.wait();
            logger_1.logger.dexOperation(operationId, 'Router approval confirmed', amountWld, 'WLD');
            // 2. Execute Swap (exactInputSingle)
            // Fee tier: 0.3% (3000) is standard for most WLD/USDC pools
            logger_1.logger.dexOperation(operationId, 'Executing swap on Uniswap V3', amountWld, 'WLD');
            // Calculate minimum output with 3% slippage protection
            // In production, fetch quote from quoter contract
            const expectedOutput = amountIn * BigInt(97) / BigInt(100); // 3% slippage tolerance
            const params = {
                tokenIn: config_1.config.WLD_TOKEN,
                tokenOut: config_1.config.USDC_TOKEN,
                fee: 3000, // 0.3% tier
                recipient: this.wallet.address,
                amountIn: amountIn,
                amountOutMinimum: expectedOutput, // 3% slippage protection
                sqrtPriceLimitX96: 0,
            };
            const swapTx = await routerContract.exactInputSingle(params);
            logger_1.logger.debug('DEX', `Swap tx sent: ${swapTx.hash.slice(0, 10)}...`, operationId);
            const receipt = await swapTx.wait();
            logger_1.logger.dexOperation(operationId, 'Swap completed successfully', amountWld, 'WLD', receipt.hash);
            return receipt.hash;
        }
        catch (err) {
            logger_1.logger.error('DEX', `Swap failed`, operationId, err);
            throw err;
        }
    }
}
exports.SwapService = SwapService;
exports.swapService = new SwapService();
//# sourceMappingURL=swapService.js.map