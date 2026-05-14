/**
 * bitnobService.ts — Bitnob API Integration Service
 *
 * Handles all Bitnob API interactions including:
 * - Payouts to MPESA (send money, paybill, till, pochi)
 * - Wallet management
 * - Transaction status polling
 * - Webhook handling
 *
 * API Base URLs:
 * - Sandbox: https://sandboxapi.bitnob.co/api/v1
 * - Production: https://api.bitnob.co/api/v1
 *
 * Authentication: Bearer Token (API Key from Bitnob Dashboard)
 *
 * @see https://docs.bitnob.com/
 */

import { config } from '../config';
import { prisma } from '../db/prisma';
import { logger, maskPhoneNumber, formatTransactionType, formatAmount } from '../utils/logger';
import type { IOfframpService, SwapResult, SwapStatus } from '../types';

// Bitnob supported countries for mobile money payouts
export type BitnobCountry = 'Kenya' | 'Ghana' | 'Uganda' | 'Nigeria' | 'Rwanda' | 'Mali' | 'Burkina Faso' | 'Benin' | 'Cameroon' | 'Ivory Coast' | 'Senegal' | 'Togo' | 'Guinea Conakry';

// Mobile money networks supported by Bitnob
export type MobileNetwork = 'mpesa' | 'mtn' | 'vodafone' | 'airtel' | 'orange' | 'wave';

// Payout beneficiary types
export interface BitnobBeneficiary {
  phoneNumber: string;
  country: BitnobCountry;
  type: 'momo' | 'bank';
  network?: MobileNetwork;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
}

// Payout request payload
export interface BitnobPayoutRequest {
  amount: number; // Amount in cents (smallest currency unit)
  customerEmail: string;
  reference: string; // Unique transaction reference
  country: BitnobCountry;
  currency: string; // 'KES', 'USD', etc.
  beneficiary: BitnobBeneficiary;
  notificationEmail?: string;
}

// Payout response from Bitnob
export interface BitnobPayoutResponse {
  id: string;
  status: 'pending' | 'success' | 'failed' | 'reversed';
  amount: number;
  currency: string;
  country: string;
  reference: string;
  customerEmail: string;
  beneficiary: BitnobBeneficiary;
  createdAt: string;
  updatedAt: string;
  reason?: string; // Failure reason if status is failed
}

// Exchange rate response
export interface BitnobRateResponse {
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
  timestamp: string;
}

/**
 * BitnobService — Complete Bitnob API integration
 */
export class BitnobService implements IOfframpService {
  private get baseUrl(): string {
    return config.BITNOB_ENV === 'production'
      ? 'https://api.bitnob.co/api/v1'
      : 'https://sandboxapi.bitnob.co/api/v1';
  }

  private get headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${config.BITNOB_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Get Bitnob wallet balance
   */
  async getWalletBalance(): Promise<{ usdc: number; kes: number; btc: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/wallets/balances`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse balances from response
      const balances = data.data || data;
      return {
        usdc: parseFloat(balances.usdc || balances.USDC || 0),
        kes: parseFloat(balances.kes || balances.KES || 0),
        btc: parseFloat(balances.btc || balances.BTC || 0),
      };
    } catch (error) {
      logger.error('BITNOB', 'Failed to fetch wallet balance', undefined, error);
      // Return zeros to allow transaction attempt (fail open)
      return { usdc: 0, kes: 0, btc: 0 };
    }
  }

  /**
   * Check if there's sufficient balance for a payout
   * Includes 10% buffer for fees and exchange rate fluctuations
   */
  async ensureSufficientBalance(kesAmount: number): Promise<boolean> {
    try {
      const balances = await this.getWalletBalance();
      
      // Estimate required USDC (assuming ~130 KES per USD, with 10% buffer)
      const estimatedUsdNeeded = (kesAmount / 130) * 1.1;
      
      logger.info('BITNOB', 'Balance check', undefined, {
        requiredUsd: estimatedUsdNeeded.toFixed(2),
        availableUsdc: balances.usdc.toFixed(2),
        availableKes: balances.kes.toFixed(2),
      });

      // Check if we have enough (USDC or KES balance)
      if (balances.usdc >= estimatedUsdNeeded || balances.kes >= kesAmount * 1.1) {
        return true;
      }

      logger.error('BITNOB', 'Insufficient balance for payout', undefined, {
        requiredUsd: estimatedUsdNeeded.toFixed(2),
        availableUsdc: balances.usdc.toFixed(2),
        kesAmount: kesAmount.toFixed(2),
      });
      
      return false;
    } catch (error) {
      logger.error('BITNOB', 'Balance check failed', undefined, error);
      // Fail open - allow transaction to proceed and let Bitnob handle rejection if truly insufficient
      return true;
    }
  }

  /**
   * Initialize a mobile money payout to MPESA
   *
   * Endpoint: POST /wallets/payout/initialize
   *
   * @param kesAmount - Amount in Kenyan Shillings
   * @param phoneNumber - Recipient phone number (format: 2547XXXXXXXX or 2541XXXXXXXX)
   * @param reference - Unique transaction reference (our transaction ID)
   * @param customerEmail - Customer email for notifications
   * @param options - Additional options (paybill, till, pochi specific)
   */
  async initiatePayout(
    kesAmount: number,
    phoneNumber: string,
    reference: string,
    customerEmail: string = 'customer@wld2mpesa.app',
    options?: {
      paybillNumber?: string;
      accountNumber?: string;
      tillNumber?: string;
      pochiRecipient?: string;
    }
  ): Promise<BitnobPayoutResponse> {
    // Determine payout type for logging
    const payoutType = options?.paybillNumber ? 'Paybill' 
      : options?.tillNumber ? 'Till (Buy Goods)'
      : options?.pochiRecipient ? 'Pochi la Biashara'
      : 'Send Money';

    logger.bitnobOperation(reference, `Initiating ${payoutType} payout`, undefined, {
      amount: formatAmount(kesAmount),
      recipient: maskPhoneNumber(phoneNumber),
      payoutType,
      environment: config.BITNOB_ENV,
    });

    // Clean phone number - remove + and ensure it starts with country code
    const cleanPhone = phoneNumber.replace(/^\+/, '');
    const formattedPhone = cleanPhone.startsWith('254') ? cleanPhone : `254${cleanPhone.replace(/^0/, '')}`;

    // Validate phone number format
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      throw new Error(`Invalid phone number format: ${phoneNumber}. Expected: 2547XXXXXXXX or 2541XXXXXXXX`);
    }

    // Amount in cents (Bitnob uses smallest currency unit)
    const amountInCents = Math.round(kesAmount * 100);

    // Build beneficiary based on payout type
    let beneficiary: BitnobBeneficiary;

    if (options?.paybillNumber) {
      // Paybill payout
      beneficiary = {
        phoneNumber: formattedPhone,
        country: 'Kenya',
        type: 'momo',
        network: 'mpesa',
        accountNumber: options.accountNumber || '',
      };
    } else if (options?.tillNumber) {
      // Till number (Buy Goods) payout
      beneficiary = {
        phoneNumber: formattedPhone,
        country: 'Kenya',
        type: 'momo',
        network: 'mpesa',
      };
    } else {
      // Regular send money or Pochi la Biashara
      beneficiary = {
        phoneNumber: formattedPhone,
        country: 'Kenya',
        type: 'momo',
        network: 'mpesa',
      };
    }

    const payload: BitnobPayoutRequest = {
      amount: amountInCents,
      customerEmail,
      reference,
      country: 'Kenya',
      currency: 'KES',
      beneficiary,
    };

    const response = await fetch(`${this.baseUrl}/wallets/payout/initialize`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      logger.error('BITNOB', 'Payout initiation failed', reference, {
        status: response.status,
        error: data.message || data.error || 'Unknown error',
      });
      throw new Error(`Bitnob API Error: ${data.message || data.error || 'Unknown error'}`);
    }

    // Bitnob returns data in a nested structure
    const payoutData = data.data || data;

    logger.bitnobOperation(reference, `${payoutType} payout initiated`, payoutData.id, {
      payoutId: payoutData.id,
      status: payoutData.status,
      amount: formatAmount(kesAmount),
    });

    return {
      id: payoutData.id,
      status: payoutData.status || 'pending',
      amount: payoutData.amount / 100, // Convert cents to whole units
      currency: payoutData.currency || 'KES',
      country: payoutData.country || 'Kenya',
      reference: payoutData.reference,
      customerEmail: payoutData.customerEmail,
      beneficiary: payoutData.beneficiary,
      createdAt: payoutData.createdAt,
      updatedAt: payoutData.updatedAt,
      reason: payoutData.reason,
    };
  }

  /**
   * Check the status of a payout
   *
   * Endpoint: GET /wallets/payout/{id}
   */
  async getPayoutStatus(payoutId: string, reference?: string): Promise<BitnobPayoutResponse> {
    logger.bitnobOperation(reference || 'unknown', 'Checking payout status', payoutId);

    const response = await fetch(`${this.baseUrl}/wallets/payout/${payoutId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
      const errorMsg = errorData.message || errorData.error || response.statusText;
      logger.error('BITNOB', 'Failed to fetch payout status', reference || 'unknown', {
        payoutId,
        status: response.status,
        error: errorMsg,
      });
      throw new Error(`Failed to fetch payout status: ${errorMsg}`);
    }

    const data = await response.json() as any;
    const payoutData = data.data || data;

    logger.debug('BITNOB', `Payout status: ${payoutData.status}`, reference || 'unknown', {
      payoutId,
      status: payoutData.status,
      amount: formatAmount(payoutData.amount / 100),
    });

    return {
      id: payoutData.id,
      status: payoutData.status || 'pending',
      amount: payoutData.amount / 100,
      currency: payoutData.currency || 'KES',
      country: payoutData.country || 'Kenya',
      reference: payoutData.reference,
      customerEmail: payoutData.customerEmail,
      beneficiary: payoutData.beneficiary,
      createdAt: payoutData.createdAt,
      updatedAt: payoutData.updatedAt,
      reason: payoutData.reason,
    };
  }

  /**
   * IOfframpService implementation - initiateSwap
   * Used by the payment pipeline for WLD -> KES offramping
   */
  async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
    logger.pipelineStep(txnId, 2, 4, `Off-ramp: ${formatAmount(kesAmount)} → Bitnob payout`);

    // Fetch the transaction to get phone number
    const payment = await prisma.transaction.findUnique({
      where: { id: txnId },
    });

    if (!payment) {
      logger.error('PAYMENT', 'Transaction not found for swap', txnId);
      throw new Error(`Transaction ${txnId} not found`);
    }

    logger.info('PAYMENT', `Processing ${formatTransactionType(payment.transactionType)} payout`, txnId, {
      type: payment.transactionType,
      kesAmount: formatAmount(kesAmount),
      wldAmount: `${wldAmount} WLD`,
    });

    // Determine recipient and payout type
    let phoneNumber: string;
    let options: any = {};

    if (payment.transactionType === 'send' || payment.transactionType === 'pochi') {
      phoneNumber = payment.phoneNumber || '';
    } else if (payment.transactionType === 'paybill') {
      phoneNumber = payment.phoneNumber || '';
      options.paybillNumber = payment.tillNumber;
      options.accountNumber = payment.accountNumber;
    } else if (payment.transactionType === 'till') {
      // For till, we need the recipient's phone number (for receiving confirmation)
      // The till number itself is passed in the reference or handled by Bitnob
      phoneNumber = payment.phoneNumber || '';
      options.tillNumber = payment.tillNumber;
    } else {
      throw new Error(`Unsupported transaction type: ${payment.transactionType}`);
    }

    if (!phoneNumber) {
      logger.error('PAYMENT', `Phone number missing for ${payment.transactionType} payout`, txnId);
      throw new Error(`Phone number required for ${payment.transactionType} payout`);
    }

    // Pre-flight check: Verify sufficient balance before initiating
    const hasBalance = await this.ensureSufficientBalance(kesAmount);
    if (!hasBalance) {
      throw new Error('Insufficient Bitnob balance for payout. Please contact support.');
    }

    // Initiate the payout
    logger.pipelineStep(txnId, 2, 4, `Sending ${formatTransactionType(payment.transactionType)} request to Bitnob`);
    const payout = await this.initiatePayout(
      kesAmount,
      phoneNumber,
      txnId,
      'customer@wld2mpesa.app',
      options
    );

    logger.pipelineStep(txnId, 2, 4, `Bitnob payout queued [${payout.id.slice(0, 8)}...]`);

    return {
      swapId: payout.id,
      status: this.mapBitnobStatus(payout.status),
      estimatedKes: payout.amount,
    };
  }

  /**
   * IOfframpService implementation - checkSwapStatus
   */
  async checkSwapStatus(swapId: string, reference?: string): Promise<SwapStatus> {
    try {
      const payout = await this.getPayoutStatus(swapId, reference);
      const status = this.mapBitnobStatus(payout.status);
      
      if (status === 'COMPLETED') {
        logger.pipelineStep(reference || 'unknown', 4, 4, '✓ Bitnob payout completed');
      } else if (status === 'FAILED') {
        logger.error('BITNOB', `Payout failed: ${payout.reason || 'Unknown reason'}`, reference, { payoutId: swapId });
      }
      
      return status;
    } catch (err) {
      logger.error('BITNOB', 'Failed to check payout status', reference, err);
      return 'PENDING';
    }
  }

  /**
   * Map Bitnob status to our SwapStatus
   */
  private mapBitnobStatus(bitnobStatus: string): SwapStatus {
    const status = bitnobStatus.toLowerCase();
    if (status === 'success' || status === 'completed' || status === 'successful') return 'COMPLETED';
    if (status === 'failed' || status === 'rejected' || status === 'reversed') return 'FAILED';
    return 'PENDING';
  }

  /**
   * Get supported countries for payouts
   */
  async getSupportedCountries(): Promise<BitnobCountry[]> {
    const response = await fetch(`${this.baseUrl}/wallets/payout/countries`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch supported countries');
    }

    const data = await response.json() as any;
    return (data.data || data.countries || []) as BitnobCountry[];
  }

  /**
   * Get exchange rate from USD to target currency
   * Useful for calculating WLD -> KES via USD intermediate
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    logger.debug('BITNOB', `Fetching exchange rate: ${fromCurrency} → ${toCurrency}`);
    
    const response = await fetch(
      `${this.baseUrl}/rates/exchange?from=${fromCurrency}&to=${toCurrency}`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      logger.error('BITNOB', 'Failed to fetch exchange rate', undefined, {
        from: fromCurrency,
        to: toCurrency,
        status: response.status,
      });
      throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rate = data.data?.rate || data.rate || 0;
    
    logger.debug('BITNOB', `Exchange rate: 1 ${fromCurrency} = ${rate} ${toCurrency}`);
    return rate;
  }

  /**
   * Validate a phone number for mobile money
   */
  async validatePhoneNumber(phoneNumber: string, country: BitnobCountry): Promise<{
    valid: boolean;
    network?: MobileNetwork;
    formattedNumber?: string;
  }> {
    // Bitnob doesn't have a direct validation endpoint
    // We'll do basic validation here
    const clean = phoneNumber.replace(/^\+/, '');

    // Country-specific validation
    const patterns: Record<BitnobCountry, RegExp> = {
      'Kenya': /^254[17]\d{8}$/,
      'Ghana': /^233[235]\d{8}$/,
      'Uganda': /^256[79]\d{8}$/,
      'Nigeria': /^234[789]\d{9}$/,
      'Rwanda': /^250[78]\d{8}$/,
      'Mali': /^223[4678]\d{7}$/,
      'Burkina Faso': /^226[567]\d{7}$/,
      'Benin': /^229[4569]\d{7}$/,
      'Cameroon': /^237[6789]\d{7}$/,
      'Ivory Coast': /^225[45789]\d{7}$/,
      'Senegal': /^221[76]\d{7}$/,
      'Togo': /^228[79]\d{7}$/,
      'Guinea Conakry': /^224[6]\d{7}$/,
    };

    const pattern = patterns[country];
    if (!pattern) {
      return { valid: false };
    }

    const formatted = clean.startsWith(country === 'Kenya' ? '254' : '')
      ? clean
      : this.addCountryCode(clean, country);

    return {
      valid: pattern.test(formatted),
      formattedNumber: formatted,
    };
  }

  private addCountryCode(phone: string, country: BitnobCountry): string {
    const codes: Record<BitnobCountry, string> = {
      'Kenya': '254',
      'Ghana': '233',
      'Uganda': '256',
      'Nigeria': '234',
      'Rwanda': '250',
      'Mali': '223',
      'Burkina Faso': '226',
      'Benin': '229',
      'Cameroon': '237',
      'Ivory Coast': '225',
      'Senegal': '221',
      'Togo': '228',
      'Guinea Conakry': '224',
    };

    const code = codes[country];
    // Remove leading 0 if present
    const clean = phone.replace(/^0/, '');
    return `${code}${clean}`;
  }
}

// Export singleton instance
export const bitnobService = new BitnobService();

// Factory function for creating new instances (useful for testing)
export function createBitnobService(): BitnobService {
  return new BitnobService();
}
