// @ts-ignore
import { signRequest } from '@worldcoin/idkit/signing';
import { config } from '../config';

/**
 * Signs a World ID 4.0 verification request using the official IDKit signing logic.
 */
export async function signVerificationRequest(action: string, _unusedNonce?: string) {
    if (!config.WLD_SIGNING_KEY) {
        throw new Error('WLD_SIGNING_KEY is not configured');
    }

    // signRequest handles nonce and timestamp generation automatically
    const result = await signRequest(action, config.WLD_SIGNING_KEY);

    return {
        rp_id: config.WLD_RP_ID,
        nonce: result.nonce,
        signature: result.sig,
        created_at: result.createdAt,
        expires_at: result.expiresAt
    };
}
