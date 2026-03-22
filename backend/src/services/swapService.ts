/**
 * swapService.ts — Automated DEX Rebalancing (WLD → USDC) on World Chain
 * 
 * Uses Uniswap V3 Universal Router
 */

import { ethers } from 'ethers';
import { config } from '../config';

// Minimal ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
];

export class SwapService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.WORLD_CHAIN_RPC_URL);
    if (!config.ADMIN_PRIVATE_KEY) {
      throw new Error('ADMIN_PRIVATE_KEY missing from environment');
    }
    this.wallet = new ethers.Wallet(config.ADMIN_PRIVATE_KEY, this.provider);
  }

  /**
   * Swaps WLD for USDC on World Chain Uniswap V3
   * @param amountWld String representation of WLD amount (e.g. "1.5")
   */
  async swapWldForUsdc(amountWld: string): Promise<string> {
    console.log(`[SwapService] Swapping ${amountWld} WLD for USDC...`);

    const wldContract = new ethers.Contract(config.WLD_TOKEN, ERC20_ABI, this.wallet);
    const routerContract = new ethers.Contract(config.UNISWAP_V3_ROUTER, ROUTER_ABI, this.wallet);

    const amountIn = ethers.parseUnits(amountWld, 18);

    // 1. Approve router to spend WLD
    console.log(' - Approving Router...');
    const approveTx = await wldContract.approve(config.UNISWAP_V3_ROUTER, amountIn);
    await approveTx.wait();

    // 2. Execute Swap (exactInputSingle)
    // Fee tier: 1% (10000) is standard for WLD/USDC on many pools, but 0.3% (3000) also common.
    // We'll use 1% based on research.
    console.log(' - Executing Swap...');
    const params = {
      tokenIn: config.WLD_TOKEN,
      tokenOut: config.USDC_TOKEN,
      fee: 10000, // 1%
      recipient: this.wallet.address,
      amountIn: amountIn,
      amountOutMinimum: 0, // In production, add slippage protection!
      sqrtPriceLimitX96: 0,
    };

    const swapTx = await routerContract.exactInputSingle(params);
    const receipt = await swapTx.wait();

    console.log(`✅ Swap completed: ${receipt.hash}`);
    return receipt.hash;
  }
}

export const swapService = new SwapService();
