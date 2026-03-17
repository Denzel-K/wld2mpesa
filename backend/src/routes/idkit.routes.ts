import { Router } from 'express';
import { config } from '../config';
import { signVerificationRequest } from '../utils/idkit';

const router = Router();

/**
 * POST /api/idkit/rp-context
 * Returns a signed rp_context for World ID 4.0 IDKit widget.
 * Required for World ID 4.0 to prevent impersonation.
 */
router.post('/rp-context', async (req, res) => {
  try {
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing action in request body' });
    }

    if (!config.WLD_SIGNING_KEY) {
      console.warn('[IDKit] WLD_SIGNING_KEY is not set. World ID 4.0 signing will fail.');
      return res.status(500).json({ error: 'World ID signing is not configured on the server.' });
    }

    const signed = await signVerificationRequest(action);
    
    return res.status(200).json({ 
      rp_context: signed
    });
  } catch (err: any) {
    console.error('[IDKit] rp-context error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const idkitRouter = router;
