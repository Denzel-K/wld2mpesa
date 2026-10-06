/**
 * swapService.ts — Automated DEX Rebalancing (WLD → USDC) on World Chain
 *
 * Uses Uniswap V3 Universal Router
 */
export declare class SwapService {
    private provider;
    private wallet;
    constructor();
    /**
     * Swaps WLD for USDC on World Chain Uniswap V3
     * @param amountWld String representation of WLD amount (e.g. "1.5")
     */
    swapWldForUsdc(amountWld: string): Promise<string>;
}
export declare const swapService: SwapService;
//# sourceMappingURL=swapService.d.ts.map