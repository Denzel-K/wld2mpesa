import { config } from '../config';
import type { IMpesaService, MpesaResult, MpesaPaymentStatus } from '../types';

const DARAJA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke';
const DARAJA_PRODUCTION_URL = 'https://api.safaricom.co.ke';

class DarajaMpesaService implements IMpesaService {
  private get baseUrl(): string {
    return config.MPESA_ENV === 'production' ? DARAJA_PRODUCTION_URL : DARAJA_SANDBOX_URL;
  }

  /**
   * Sends KES to a merchant's M-Pesa Till (Buy Goods shortcode).
   */
  async sendToTill(tillNumber: string, kesAmount: number, txnId: string): Promise<MpesaResult> {
    const token = await this.getAccessToken();

    // For Sandbox, you often use a fixed SecurityCredential or the Passkey depending on the API.
    // For B2B / BusinessBuyGoods, it usually requires RSA encryption of the initiator password.
    // TEMPORARY: In sandbox, some APIs allow the password as-is or a fixed string if using STK Push,
    // but for B2B we'll use a placeholder or the Passkey if configured.
    const credential = config.MPESA_PASSKEY || 'SAndboxCredentialPlaceholder';

    console.log(`[Mpesa] Initiating B2B payment to Till ${tillNumber} for ${txnId}...`);

    try {
      const response = await fetch(`${this.baseUrl}/mpesa/b2b/v1/paymentrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Initiator: config.MPESA_INITIATOR_NAME,
          SecurityCredential: credential,
          CommandID: 'BusinessBuyGoods',
          Amount: Math.floor(kesAmount).toString(),
          PartyA: config.MPESA_B2B_SHORTCODE,
          PartyB: tillNumber,
          Remarks: `WLD2Cash-${txnId}`,
          QueueTimeOutURL: `${config.BACKEND_URL}/api/mpesa/timeout`,
          ResultURL: `${config.BACKEND_URL}/api/mpesa/result`,
          AccountReference: txnId,
          Requester: '',
        }),
      });

      const data: any = await response.json();

      if (data.ResponseCode !== '0') {
        console.error('[Mpesa] Daraja API rejection:', data);
        throw new Error(`Daraja B2B error: ${data.ResponseDescription}`);
      }

      return {
        requestId: data.ConversationID,
        status: 'PENDING',
      };
    } catch (err) {
      console.error('[Mpesa] Disbursement failed:', err);
      throw err;
    }
  }

  async checkPaymentStatus(_requestId: string): Promise<MpesaPaymentStatus> {
    // In production, we rely on the ResultURL (webhook) to mark as SUCCESS.
    // This is just a fallback.
    return 'PENDING';
  }

  getReceiptNumber(_requestId: string): string | undefined {
    return undefined; // Handled via webhook callback
  }

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(
      `${config.MPESA_CONSUMER_KEY}:${config.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    try {
      const response = await fetch(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { 'Authorization': `Basic ${credentials}` } }
      );

      if (!response.ok) {
        throw new Error(`M-Pesa OAuth failed: ${response.status}`);
      }

      const data: any = await response.json();
      return data.access_token;
    } catch (err) {
      console.error('[Mpesa] OAuth error:', err);
      throw err;
    }
  }
}

export function createMpesaService(): IMpesaService {
  return new DarajaMpesaService();
}

export const mpesaService = createMpesaService();
