/**
 * darajaService.ts — M-Pesa Daraja API integration
 *
 * Handles Paybill payments directly through Safaricom's M-Pesa API
 * Used for "paybill" transaction type in the hybrid architecture
 */
interface STKPushRequest {
    phoneNumber: string;
    amount: number;
    accountNumber: string;
    paybillNumber: string;
    callbackUrl: string;
    description: string;
}
interface STKPushResponse {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage?: string;
}
interface TransactionStatusRequest {
    checkoutRequestId: string;
}
interface TransactionStatusResponse {
    ResponseCode: string;
    ResponseDescription: string;
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResultCode: string;
    ResultDesc: string;
}
declare class DarajaService {
    private accessToken;
    private tokenExpiry;
    /**
     * Get OAuth access token from Daraja
     */
    private getAccessToken;
    /**
     * Generate password for STK push
     * Base64 encoded string of Shortcode+Passkey+Timestamp
     */
    private generatePassword;
    /**
     * Generate timestamp in YYYYMMDDHHMMSS format
     */
    private generateTimestamp;
    /**
     * Initiate STK Push for Paybill payment
     * This prompts the user to enter their M-Pesa PIN to complete the payment
     */
    initiatePaybillPayment(params: STKPushRequest): Promise<STKPushResponse>;
    /**
     * Check status of STK Push transaction
     */
    checkTransactionStatus(params: TransactionStatusRequest): Promise<TransactionStatusResponse>;
    /**
     * Validate configuration
     */
    validateConfig(): Promise<{
        valid: boolean;
        error?: string;
    }>;
}
export declare const darajaService: DarajaService;
export {};
//# sourceMappingURL=darajaService.d.ts.map