"use strict";
/**
 * darajaService.ts — M-Pesa Daraja API integration
 *
 * Handles Paybill payments directly through Safaricom's M-Pesa API
 * Used for "paybill" transaction type in the hybrid architecture
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.darajaService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
// Safaricom Daraja API endpoints
const DARAJA_BASE_URL = config_1.config.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
class DarajaService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }
    /**
     * Get OAuth access token from Daraja
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }
        try {
            const auth = Buffer.from(`${config_1.config.MPESA_CONSUMER_KEY}:${config_1.config.MPESA_CONSUMER_SECRET}`).toString('base64');
            const response = await axios_1.default.get(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            });
            this.accessToken = response.data.access_token;
            // Set expiry 5 minutes before actual expiry for safety
            const expiresIn = parseInt(response.data.expires_in) - 300;
            this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
            logger_1.logger.info('DARAJA', 'Access token obtained');
            return this.accessToken;
        }
        catch (error) {
            logger_1.logger.error('DARAJA', 'Failed to get access token', undefined, error);
            throw new Error('Failed to authenticate with M-Pesa Daraja');
        }
    }
    /**
     * Generate password for STK push
     * Base64 encoded string of Shortcode+Passkey+Timestamp
     */
    generatePassword(timestamp) {
        const password = `${config_1.config.MPESA_SHORTCODE}${config_1.config.MPESA_PASSKEY}${timestamp}`;
        return Buffer.from(password).toString('base64');
    }
    /**
     * Generate timestamp in YYYYMMDDHHMMSS format
     */
    generateTimestamp() {
        const now = new Date();
        return now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
    }
    /**
     * Initiate STK Push for Paybill payment
     * This prompts the user to enter their M-Pesa PIN to complete the payment
     */
    async initiatePaybillPayment(params) {
        const token = await this.getAccessToken();
        const timestamp = this.generateTimestamp();
        const password = this.generatePassword(timestamp);
        // Format phone number (remove + and ensure 254 prefix)
        const formattedPhone = params.phoneNumber.replace(/^\+?/, '');
        const phoneNumber = formattedPhone.startsWith('254')
            ? formattedPhone
            : `254${formattedPhone.replace(/^0/, '')}`;
        const requestBody = {
            BusinessShortCode: config_1.config.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: params.amount,
            PartyA: phoneNumber,
            PartyB: params.paybillNumber,
            PhoneNumber: phoneNumber,
            CallBackURL: params.callbackUrl,
            AccountReference: params.accountNumber,
            TransactionDesc: params.description.slice(0, 13), // Max 13 chars
        };
        try {
            logger_1.logger.info('DARAJA', 'Initiating STK Push', undefined, {
                paybillNumber: params.paybillNumber,
                accountNumber: params.accountNumber,
                amount: params.amount,
            });
            const response = await axios_1.default.post(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, requestBody, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.ResponseCode !== '0') {
                throw new Error(`STK Push failed: ${response.data.ResponseDescription}`);
            }
            logger_1.logger.info('DARAJA', 'STK Push initiated successfully', undefined, {
                merchantRequestId: response.data.MerchantRequestID,
                checkoutRequestId: response.data.CheckoutRequestID,
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('DARAJA', 'STK Push initiation failed', undefined, error);
            throw error;
        }
    }
    /**
     * Check status of STK Push transaction
     */
    async checkTransactionStatus(params) {
        const token = await this.getAccessToken();
        const timestamp = this.generateTimestamp();
        const password = this.generatePassword(timestamp);
        const requestBody = {
            BusinessShortCode: config_1.config.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: params.checkoutRequestId,
        };
        try {
            const response = await axios_1.default.post(`${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`, requestBody, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('DARAJA', 'Transaction status check failed', undefined, error);
            throw error;
        }
    }
    /**
     * Validate configuration
     */
    async validateConfig() {
        try {
            await this.getAccessToken();
            return { valid: true };
        }
        catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
exports.darajaService = new DarajaService();
//# sourceMappingURL=darajaService.js.map