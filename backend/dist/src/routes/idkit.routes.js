"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idkitRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const idkit_1 = require("../utils/idkit");
const router = (0, express_1.Router)();
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
        if (!config_1.config.WLD_SIGNING_KEY) {
            console.warn('[IDKit] WLD_SIGNING_KEY is not set. World ID 4.0 signing will fail.');
            return res.status(500).json({ error: 'World ID signing is not configured on the server.' });
        }
        const signed = await (0, idkit_1.signVerificationRequest)(action);
        return res.status(200).json({
            rp_context: signed
        });
    }
    catch (err) {
        console.error('[IDKit] rp-context error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.idkitRouter = router;
//# sourceMappingURL=idkit.routes.js.map