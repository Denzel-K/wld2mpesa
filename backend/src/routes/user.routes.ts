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
    const nonceValid = validateNonce(nonce);
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

    // Normalize possible casing variants from MiniKit payloads (snake_case vs camelCase)
    const normalizedProof = {
        nullifier_hash: worldIdProof.nullifier_hash ?? worldIdProof.nullifierHash,
        merkle_root: worldIdProof.merkle_root ?? worldIdProof.merkleRoot,
        proof: worldIdProof.proof,
        verification_level: worldIdProof.verification_level ?? worldIdProof.verificationLevel,
    } as Record<string, unknown>;

    // Validate incoming World ID proof structure early to avoid hitting the Worldcoin API with invalid data.
    const isHexString = (val: unknown): val is string => {
        return typeof val === 'string' && /^(0x)?[0-9a-fA-F]+$/.test(val);
    };

    if (
        !isHexString(normalizedProof.nullifier_hash) ||
        !isHexString(normalizedProof.merkle_root) ||
        !isHexString(normalizedProof.proof) ||
        typeof normalizedProof.verification_level !== 'string'
    ) {
        return res.status(400).json({
            error: 'Invalid World ID proof',
            details: 'Expected nullifier_hash, merkle_root, proof (hex strings) and verification_level (string).',
            received: {
              nullifier_hash: normalizedProof.nullifier_hash,
              merkle_root: normalizedProof.merkle_root,
              proof: normalizedProof.proof,
              verification_level: normalizedProof.verification_level,
            },
        });
    }

    // 1. Verify World ID Proof with World App API
    // In simulation mode, we skip actual API call
    let verified = false;

    try {
      console.log(`[Verify] Verifying World ID proof (app=${config.WLD_APP_ID} action=${config.WLD_ACTION_ID}) for ${walletAddress}`);
      console.log(`[Verify] Normalized proof:`, JSON.stringify({
        nullifier_hash: normalizedProof.nullifier_hash,
        merkle_root: normalizedProof.merkle_root,
        proof: normalizedProof.proof?.substring(0, 50) + '...',
        verification_level: normalizedProof.verification_level,
      }, null, 2));
      const verifyResponse = await fetch(`https://developer.worldcoin.org/api/v2/verify/${config.WLD_APP_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifier_hash: normalizedProof.nullifier_hash,
          merkle_root: normalizedProof.merkle_root,
          proof: normalizedProof.proof,
          verification_level: normalizedProof.verification_level,
          action: config.WLD_ACTION_ID,
          signal: walletAddress,
        }),
      });

      const responseText = await verifyResponse.text();

            if (!verifyResponse.ok) {
                console.error(`[Verify] Worldcoin API error (${verifyResponse.status}) (app=${config.WLD_APP_ID} action=${config.WLD_ACTION_ID}):`, responseText);
                return res.status(verifyResponse.status).json({
                    error: 'Identity verification failed',
                    details: responseText,
                    appId: config.WLD_APP_ID,
                    actionId: config.WLD_ACTION_ID,
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

    if (!verified) {
        return res.status(400).json({ error: 'Invalid World ID proof' });
    }

    // 2. Create or Update User
    const user = await userStore.createOrUpdate({
        walletAddress,
        nullifierHash: normalizedProof.nullifier_hash as string,
        verificationLevel: normalizedProof.verification_level as string,
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
