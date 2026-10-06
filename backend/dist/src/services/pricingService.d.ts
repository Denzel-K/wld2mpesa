export type PaymentRail = 'send' | 'paybill' | 'pochi' | 'till';
export interface FeeQuote {
    pricingVersion: string;
    transactionType: PaymentRail;
    recipientAmountKes: number;
    userServiceFeeKes: number;
    platformFeePercent: number;
    fixedServiceFeeKes: number;
    userRailFeeKes: number;
    totalUserFeeKes: number;
    totalUserPaysKes: number;
    wldAmount: string;
    feeWld: string;
    wldRateKes: number;
    platformCosts: {
        offrampReserveKes: number;
        dexReserveKes: number;
        gasReserveKes: number;
        mpesaRailReserveKes: number;
    };
    minimumMarginKes: number;
    expectedNetMarginKes: number;
}
/** Safaricom B2C tariff to registered users (business paid). */
export declare function b2cRailFee(amount: number): number;
export declare function quotePayment(amount: number, rail: PaymentRail, wldRateKes: number): FeeQuote;
//# sourceMappingURL=pricingService.d.ts.map