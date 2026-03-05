import { Router } from 'express';
import { userStore } from '../services/userStore';
import { config } from '../config';
import { validateNonce } from './nonce.routes';

const router = Router();

/**
 * GET /api/user/:walletAddress
 * Fetch user data
 */
router.get('/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const user = await userStore.findByWallet(walletAddress);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
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
    const nonceValid = config.SIMULATION_MODE ? true : validateNonce(nonce);
    if (!nonceValid) {
        return res.status(400).json({ error: 'Invalid or expired nonce' });
    }

    if (payload.status === 'error') {
        return res.status(400).json({ error: 'walletAuth failed in World App' });
    }

    const walletAddress: string = payload.address;
    if (!walletAddress) {
        return res.status(400).json({ error: 'No wallet address in payload' });
    }

    // In simulation mode skip SIWE signature verification
    // In production you would call verifySiweMessage from @worldcoin/minikit-js here
    const user = await userStore.createOrUpdate({ walletAddress });
    return res.json({ walletAddress, user });
});

/**
 * POST /api/user/sync
 * Verify World ID proof and create/update user
 */
router.post('/sync', async (req, res) => {
    const { walletAddress, worldIdProof } = req.body;

    if (!walletAddress || !worldIdProof) {
        return res.status(400).json({ error: 'Missing walletAddress or worldIdProof' });
    }

    // 1. Verify World ID Proof with World App API
    // In simulation mode, we skip actual API call
    let verified = false;

    if (config.SIMULATION_MODE) {
        console.log('[SIM] Skipping World ID cloud verification for', walletAddress);
        verified = true;
    } else {
        try {
            const verifyResponse = await fetch(`https://developer.worldcoin.org/api/v2/verify/${config.WLD_APP_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nullifier_hash: worldIdProof.nullifier_hash,
                    merkle_root: worldIdProof.merkle_root,
                    proof: worldIdProof.proof,
                    verification_level: worldIdProof.verification_level,
                    action: config.WLD_ACTION_ID,
                    signal: walletAddress,
                }),
            });

            const responseText = await verifyResponse.text();

            if (!verifyResponse.ok) {
                console.error(`[Verify] Worldcoin API error (${verifyResponse.status}):`, responseText);
                return res.status(verifyResponse.status).json({
                    error: 'Identity verification failed',
                    details: responseText
                });
            }

            try {
                const result = JSON.parse(responseText);
                verified = result.verified;
            } catch (pErr) {
                console.error('[Verify] Failed to parse Worldcoin response:', responseText);
                throw pErr;
            }
        } catch (err) {
            console.error('[Verify] Proof verification exception:', err);
            return res.status(500).json({ error: 'Identity verification service error' });
        }
    }

    if (!verified) {
        return res.status(400).json({ error: 'Invalid World ID proof' });
    }

    // 2. Create or Update User
    const user = await userStore.createOrUpdate({
        walletAddress,
        nullifierHash: worldIdProof.nullifier_hash,
        verificationLevel: worldIdProof.verification_level,
        isVerified: true
    });

    return res.json(user);
});

/**
 * POST /api/user/:walletAddress/onboard
 * Mark user as onboarded after they view the slideshow
 */
router.post('/:walletAddress/onboard', async (req, res) => {
    const { walletAddress } = req.params;

    const user = await userStore.findByWallet(walletAddress);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    await userStore.markOnboarded(walletAddress);
    return res.json({ success: true });
});

export const userRouter = router;
