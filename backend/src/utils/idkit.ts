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

    // IMPORTANT: World ID 4.0 signatures MUST be based on the RP_ID, not the action ID.
    const result = await signRequest(config.WLD_RP_ID, config.WLD_SIGNING_KEY);

    return {
        rp_id: config.WLD_RP_ID,
        nonce: result.nonce,
        signature: result.sig,
        created_at: result.createdAt,
        expires_at: result.expiresAt
    };
}
