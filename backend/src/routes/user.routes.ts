import { Router } from 'express';
import { userStore } from '../services/userStore';
import { config } from '../config';

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
            const verifyResponse = await fetch(`https://developer.worldcoin.org/api/v1/verify/${config.WLD_APP_ID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nullifier_hash: worldIdProof.nullifier_hash,
                    merkle_root: worldIdProof.merkle_root,
                    proof: worldIdProof.proof,
                    verification_level: worldIdProof.verification_level,
                    action: 'wld2mpesa-login', // Match the action in frontend
                    signal: walletAddress,
                }),
            });

            const result: any = await verifyResponse.json();
            verified = result.verified;
        } catch (err) {
            console.error('[Verify] Proof verification failed:', err);
            return res.status(500).json({ error: 'Identity verification service unavailable' });
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
