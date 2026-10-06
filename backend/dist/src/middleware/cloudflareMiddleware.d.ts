import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to handle Cloudflare-specific headers.
 * Extracts the real client IP accurately if Cloudflare is enabled.
 */
export declare function cloudflareMiddleware(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=cloudflareMiddleware.d.ts.map