"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudflareMiddleware = cloudflareMiddleware;
const config_1 = require("../config");
/**
 * Middleware to handle Cloudflare-specific headers.
 * Extracts the real client IP accurately if Cloudflare is enabled.
 */
function cloudflareMiddleware(req, _res, next) {
    if (config_1.config.CLOUDFLARE_ENABLED) {
        const cfIp = req.headers['cf-connecting-ip'];
        if (cfIp) {
            // Override the request IP with the one from Cloudflare
            Object.defineProperty(req, 'ip', {
                value: Array.isArray(cfIp) ? cfIp[0] : cfIp,
                writable: false,
            });
        }
    }
    next();
}
//# sourceMappingURL=cloudflareMiddleware.js.map