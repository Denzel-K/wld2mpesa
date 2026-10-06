"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signVerificationRequest = signVerificationRequest;
// @ts-ignore
const signing_1 = require("@worldcoin/idkit/signing");
const config_1 = require("../config");
/**
 * Signs a World ID 4.0 verification request using the official IDKit signing logic.
 */
async function signVerificationRequest(_action, _unusedNonce) {
    if (!config_1.config.WLD_SIGNING_KEY) {
        throw new Error('WLD_SIGNING_KEY is not configured');
    }
    // IMPORTANT: World ID 4.0 signatures MUST be based on the RP_ID, not the action ID.
    const result = await (0, signing_1.signRequest)(config_1.config.WLD_RP_ID, config_1.config.WLD_SIGNING_KEY);
    return {
        rp_id: config_1.config.WLD_RP_ID,
        nonce: result.nonce,
        signature: result.sig,
        created_at: result.createdAt,
        expires_at: result.expiresAt
    };
}
//# sourceMappingURL=idkit.js.map