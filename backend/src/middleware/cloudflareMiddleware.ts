import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Middleware to handle Cloudflare-specific headers.
 * Extracts the real client IP accurately if Cloudflare is enabled.
 */
export function cloudflareMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (config.CLOUDFLARE_ENABLED) {
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
