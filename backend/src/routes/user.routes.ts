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
    const { walletAddress, worldIdProof, actionId, v4Result, rpContext } = req.body;

    if (!walletAddress || (!worldIdProof && !v4Result) || !actionId) {
        return res.status(400).json({ error: 'Missing walletAddress, worldIdProof/v4Result, or actionId' });
    }

    // Ensure the action is one of the ones we allow
    if (actionId !== config.WLD_LOGIN_ACTION_ID && actionId !== config.WLD_PAY_ACTION_ID) {
        return res.status(400).json({ error: 'Invalid actionId provided' });
    }

    let verified = false;
    let nullifierHash = '';
    let verificationLevel = '';

    try {
      console.log(`[Verify] Verifying World ID proof (app=${config.WLD_APP_ID} action=${actionId}) for ${walletAddress}`);
      
      let verifyBody: any;
      if (v4Result) {
        // v4 Pass-through: result from IDKit
        // World ID 4.0 expects a 'responses' array. 
        // If IDKit already gave us a v4Result, check if it has 'responses'.
        if (v4Result.responses && Array.isArray(v4Result.responses)) {
            verifyBody = { ...v4Result, action: actionId, signal: walletAddress };
        } else {
            // If it's a flat result (e.g. from an older IDKit or manual call), wrap it.
            const isV4Proof = Array.isArray(v4Result.proof);
            verifyBody = {
                action: actionId,
                signal: walletAddress,
                protocol_version: isV4Proof ? "4.0" : "3.0",
                allow_legacy_proofs: true,
                ...rpContext, // Spread nonce, signature, etc.
                responses: [{ 
                    ...v4Result,
                    nullifier: v4Result.nullifier_hash ?? v4Result.nullifierHash,
                    identifier: v4Result.verification_level ?? v4Result.verificationLevel ?? 'orb'
                }]
            };
        }
      } else {
        // Legacy fallback from manual worldIdProof object
        const proof = worldIdProof.proof;
        const isV4Proof = Array.isArray(proof);
        
        verifyBody = {
          action: actionId,
          signal: walletAddress,
          protocol_version: isV4Proof ? "4.0" : "3.0",
          allow_legacy_proofs: true,
          ...rpContext, // Spread nonce, signature, etc.
          responses: [{
            nullifier: worldIdProof.nullifier_hash ?? worldIdProof.nullifierHash,
            proof: proof,
            merkle_root: worldIdProof.merkle_root ?? worldIdProof.merkleRoot,
            identifier: worldIdProof.verification_level ?? worldIdProof.verificationLevel ?? 'orb',
          }]
        };
      }

      console.log(`[Verify] Sending payload to v4/verify:`, JSON.stringify(verifyBody, null, 2));

      const isStaging = !config.IS_PRODUCTION;
      const verifyUrl = `https://developer.world.org/api/v4/verify/${config.WLD_RP_ID}${isStaging ? '?is_staging=true' : ''}`;
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyBody),
      });

      const responseText = await verifyResponse.text();

            if (!verifyResponse.ok) {
                console.error(`[Verify] Worldcoin API error (${verifyResponse.status}) (app=${config.WLD_APP_ID} action=${actionId}):`, responseText);
                return res.status(verifyResponse.status).json({
                    error: 'Identity verification failed',
                    details: responseText,
                    appId: config.WLD_APP_ID,
                    actionId: actionId,
                    endpoint: 'v4',
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
        nullifierHash: nullifierHash,
        verificationLevel: verificationLevel,
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
