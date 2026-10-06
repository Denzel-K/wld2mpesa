/**
 * Signs a World ID 4.0 verification request using the official IDKit signing logic.
 */
export declare function signVerificationRequest(_action: string, _unusedNonce?: string): Promise<{
    rp_id: string;
    nonce: any;
    signature: any;
    created_at: any;
    expires_at: any;
}>;
//# sourceMappingURL=idkit.d.ts.map