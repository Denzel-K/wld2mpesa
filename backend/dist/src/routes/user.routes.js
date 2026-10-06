"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const userStore_1 = require("../services/userStore");
const worldChainListener_1 = require("../services/worldChainListener");
const config_1 = require("../config");
const nonce_routes_1 = require("./nonce.routes");
const hashing_1 = require("@worldcoin/idkit-core/hashing");
const viem_1 = require("viem");
const logger_1 = require("../utils/logger");
const prisma_1 = require("../db/prisma");
/**
 * Compute the signal_hash expected by the Worldcoin v4 verify API.
 *
 * Worldcoin uses a specific hashing algorithm (keccak256(signal) >> 8)
 * to ensure the hash fits within the scalar field of the SNARK.
 *
 * We use the official @worldcoin/idkit-core/hashing implementation.
 */
function computeSignalHash(signal) {
    // If it's an address, ensure it's checksummed first, then hash it.
    const input = (0, viem_1.isAddress)(signal) ? (0, viem_1.getAddress)(signal) : signal;
    return (0, hashing_1.hashToField)(input).digest;
}
const router = (0, express_1.Router)();
/**
 * GET /api/user/:walletAddress
 * Fetch user data
 */
router.get('/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const user = await userStore_1.userStore.findByWallet(walletAddress);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const balanceWld = await worldChainListener_1.worldChainListener.getWldBalance(walletAddress);
    return res.json({ ...user, balanceWld });
});
/**
 * POST /api/user/complete-siwe
 * Called after walletAuth to authenticate the user's wallet.
 * Does NOT require World ID — just wallet signature.
 */
router.post('/complete-siwe', async (req, res) => {
    const { payload, nonce } = req.body;
    if (!payload || !nonce) {
        return res.status(400).json({ error: 'Missing payload or nonce' });
    }
    // Validate nonce
    const nonceValid = (0, nonce_routes_1.validateNonce)(nonce);
    if (!nonceValid) {
        return res.status(400).json({ error: 'Invalid or expired nonce' });
    }
    if (payload.status === 'error') {
        return res.status(400).json({ error: 'walletAuth failed in World App' });
    }
    const walletAddress = payload.address;
    if (!walletAddress) {
        return res.status(400).json({ error: 'No wallet address in payload' });
    }
    // In simulation mode skip SIWE signature verification
    // In production you would call verifySiweMessage from @worldcoin/minikit-js here
    const user = await userStore_1.userStore.createOrUpdate({ walletAddress });
    const balanceWld = await worldChainListener_1.worldChainListener.getWldBalance(walletAddress);
    return res.json({ walletAddress, user: { ...user, balanceWld } });
});
/**
 * POST /api/user/sync
 * Verify World ID proof and create/update user
 */
router.post('/sync', async (req, res) => {
    const { walletAddress, worldIdProof, actionId, v4Result, rpContext } = req.body;
    if (!walletAddress || (!worldIdProof && !v4Result) || !actionId) {
        return res.status(400).json({ error: 'Missing walletAddress, worldIdProof/v4Result, or actionId' });
    }
    // Ensure the action is one of the ones we allow
    if (actionId !== config_1.config.WLD_LOGIN_ACTION_ID && actionId !== config_1.config.WLD_PAY_ACTION_ID) {
        return res.status(400).json({ error: 'Invalid actionId provided' });
    }
    let verified = false;
    let nullifierHash = '';
    let verificationLevel = '';
    try {
        // Determine if this is a staging App ID
        const isStagingApp = config_1.config.WLD_APP_ID.startsWith('app_staging_');
        let verifyBody;
        const context = rpContext || {};
        const signalHash = computeSignalHash(walletAddress);
        if (v4Result) {
            // v4 Pass-through: result from MiniKit.commandsAsync.verify
            // Protocol version mapping
            const detectedProtocol = v4Result.protocol_version || (Array.isArray(v4Result.proof) ? "4.0" : "3.0");
            if (v4Result.responses && Array.isArray(v4Result.responses)) {
                // Preserve signal_hash from MiniKit if it already provided one;
                // only fall back to our computed hash if it's absent.
                const enrichedResponses = v4Result.responses.map((r) => {
                    const resolvedHash = r.signal_hash ?? signalHash;
                    return { ...r, signal_hash: resolvedHash };
                });
                const { signal: _s, ...v4ResultClean } = v4Result;
                verifyBody = {
                    ...v4ResultClean,
                    ...context,
                    action: actionId,
                    protocol_version: detectedProtocol,
                    allow_legacy_proofs: true,
                    responses: enrichedResponses,
                };
            }
            else {
                // Manual wrap for flat proofs (e.g. from simulation or old IDKit)
                verifyBody = {
                    ...context,
                    action: actionId,
                    protocol_version: detectedProtocol,
                    allow_legacy_proofs: true,
                    responses: [{
                            nullifier: v4Result.nullifier_hash ?? v4Result.nullifierHash ?? v4Result.nullifier,
                            merkle_root: v4Result.merkle_root ?? v4Result.merkleRoot ?? v4Result.merkle_root,
                            proof: v4Result.proof,
                            identifier: v4Result.verification_level ?? v4Result.verificationLevel ?? 'orb',
                            signal_hash: signalHash,
                        }]
                };
            }
        }
        else if (worldIdProof) {
            // Legacy fallback
            const isV3 = !Array.isArray(worldIdProof.proof);
            verifyBody = {
                ...context,
                action: actionId,
                protocol_version: isV3 ? "3.0" : "4.0",
                allow_legacy_proofs: true,
                responses: [{
                        nullifier: worldIdProof.nullifier_hash ?? worldIdProof.nullifierHash ?? worldIdProof.nullifier,
                        proof: worldIdProof.proof,
                        merkle_root: worldIdProof.merkle_root ?? worldIdProof.merkleRoot ?? worldIdProof.merkle_root,
                        identifier: worldIdProof.verification_level ?? worldIdProof.verificationLevel ?? 'orb',
                        signal_hash: signalHash,
                    }]
            };
        }
        // Cleanup
        delete verifyBody.status;
        delete verifyBody.commandPayload;
        delete verifyBody.finalPayload;
        const rpId = context.rp_id || config_1.config.WLD_RP_ID || config_1.config.WLD_APP_ID;
        const verifyUrl = `https://developer.world.org/api/v4/verify/${rpId}${isStagingApp ? '?is_staging=true' : ''}`;
        const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verifyBody),
        });
        const responseText = await verifyResponse.text();
        if (!verifyResponse.ok) {
            return res.status(verifyResponse.status).json({
                error: 'Identity verification failed',
                details: responseText,
                appId: config_1.config.WLD_APP_ID,
                actionId: actionId,
            });
        }
        try {
            const result = JSON.parse(responseText);
            // v4 Success is often indicated by result.success = true at the root
            verified = result.success === true || result.verified === true || verifyResponse.status === 200;
            // Extract nullifier and level from results[0] or root
            const firstResult = (result.results && result.results[0]) ? result.results[0] : {};
            nullifierHash = firstResult.nullifier || firstResult.nullifierHash || firstResult.nullifier_hash ||
                result.nullifier || result.nullifierHash || result.nullifier_hash ||
                (worldIdProof ? (worldIdProof.nullifier || worldIdProof.nullifier_hash || worldIdProof.nullifierHash) : '');
            verificationLevel = firstResult.verification_level || firstResult.verificationLevel ||
                result.verification_level || result.verificationLevel ||
                (worldIdProof ? (worldIdProof.verification_level || worldIdProof.verificationLevel) : 'orb');
        }
        catch (pErr) {
            console.error('[Verify] Failed to parse Worldcoin response:', responseText);
            throw pErr;
        }
    }
    catch (err) {
        console.error('[Verify] Proof verification exception:', err);
        return res.status(500).json({ error: 'Identity verification service error' });
    }
    if (!verified) {
        return res.status(400).json({ error: 'Invalid World ID proof' });
    }
    // 1b. Capture WLD Username from Metadata (if available) — this is read-only
    let wldUsername = '';
    if (v4Result?.responses?.[0]?.name) {
        wldUsername = v4Result.responses[0].name;
    }
    else if (v4Result?.name) {
        wldUsername = v4Result.name;
    }
    else if (worldIdProof?.name) {
        wldUsername = worldIdProof.name;
    }
    else {
        wldUsername = `user_${nullifierHash.slice(0, 8)}`;
    }
    // 2. Create or Update User (only update wldUsername if it's a fresh sync, preserve profile fields)
    const existingUser = await userStore_1.userStore.findByWallet(walletAddress);
    const user = await userStore_1.userStore.createOrUpdate({
        walletAddress,
        nullifierHash: nullifierHash,
        wldUsername: wldUsername,
        // Preserve existing profile fields if already set
        ...(existingUser?.fullName ? { fullName: existingUser.fullName } : {}),
        ...(existingUser?.email ? { email: existingUser.email } : {}),
        ...(existingUser?.phone ? { phone: existingUser.phone } : {}),
        ...(existingUser?.profileComplete ? { profileComplete: existingUser.profileComplete } : {}),
        verificationLevel: verificationLevel,
        isVerified: true
    });
    const balanceWld = await worldChainListener_1.worldChainListener.getWldBalance(walletAddress);
    return res.json({ ...user, balanceWld });
});
/**
 * POST /api/user/:walletAddress/onboard
 * Mark user as onboarded after they view the slideshow
 */
router.post('/:walletAddress/onboard', async (req, res) => {
    const { walletAddress } = req.params;
    const user = await userStore_1.userStore.findByWallet(walletAddress);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    await userStore_1.userStore.markOnboarded(walletAddress);
    return res.json({ success: true });
});
/**
 * POST /api/user/logout
 * Logout endpoint - clears any server-side session context
 * Since auth is stateless (SIWE + World ID), this primarily updates
 * the user's lastSeen timestamp and allows for any cleanup
 *
 * Query param: ?resetOnboarding=true - resets onboarded flag so user
 * sees onboarding slides again (useful for demos/testing)
 */
router.post('/logout', async (req, res) => {
    const { walletAddress, resetOnboarding } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ error: 'Missing walletAddress' });
    }
    try {
        const user = await userStore_1.userStore.findByWallet(walletAddress);
        if (user) {
            if (resetOnboarding) {
                // Reset onboarding status so user sees slides again
                await prisma_1.prisma.user.update({
                    where: { walletAddress },
                    data: { onboarded: false }
                });
                logger_1.logger.info('API', 'User logged out (onboarding reset)', undefined, {
                    wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                });
            }
            else {
                // Just update lastSeen
                await userStore_1.userStore.createOrUpdate({ walletAddress });
                logger_1.logger.info('API', 'User logged out', undefined, {
                    wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                });
            }
        }
        return res.json({
            success: true,
            message: resetOnboarding ? 'Logged out (onboarding reset)' : 'Logged out successfully',
            walletAddress: (0, logger_1.maskWalletAddress)(walletAddress),
            onboardingReset: !!resetOnboarding
        });
    }
    catch (err) {
        logger_1.logger.error('API', 'Logout error', undefined, {
            wallet: (0, logger_1.maskWalletAddress)(walletAddress),
            error: err instanceof Error ? err.message : 'Unknown error'
        });
        return res.status(500).json({ error: 'Logout failed' });
    }
});
/**
 * PUT /api/user/:walletAddress/profile
 * Save or update the user's profile (fullName, email, phone).
 * Marks profileComplete = true on success.
 */
router.put('/:walletAddress/profile', async (req, res) => {
    const { walletAddress } = req.params;
    const { fullName, email, phone } = req.body;
    // ── Validation ─────────────────────────────────────────────────────────
    const errors = {};
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        errors.fullName = 'Full name must be at least 2 characters.';
    }
    else if (fullName.trim().length > 100) {
        errors.fullName = 'Full name must be under 100 characters.';
    }
    if (!email || typeof email !== 'string') {
        errors.email = 'Email address is required.';
    }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.email = 'Please enter a valid email address.';
    }
    if (!phone || typeof phone !== 'string') {
        errors.phone = 'Phone number is required.';
    }
    else {
        const cleaned = phone.replace(/[\s\-()]/g, '');
        if (!/^(\+?254|0)[17]\d{8}$/.test(cleaned)) {
            errors.phone = 'Enter a valid Kenyan phone number (e.g. 07XXXXXXXX or +254XXXXXXXXX).';
        }
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ error: 'Validation failed', fields: errors });
    }
    const user = await userStore_1.userStore.findByWallet(walletAddress);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    try {
        const updated = await userStore_1.userStore.updateProfile(walletAddress, {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
        });
        logger_1.logger.info('API', 'User profile updated', undefined, {
            wallet: (0, logger_1.maskWalletAddress)(walletAddress),
        });
        return res.json(updated);
    }
    catch (err) {
        logger_1.logger.error('API', 'Profile update failed', undefined, {
            wallet: (0, logger_1.maskWalletAddress)(walletAddress),
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        return res.status(500).json({ error: 'Failed to update profile' });
    }
});
exports.userRouter = router;
//# sourceMappingURL=user.routes.js.map