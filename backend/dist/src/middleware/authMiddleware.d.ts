/**
 * authMiddleware.ts — Authentication middleware for admin routes
 */
import { Request, Response, NextFunction } from 'express';
import { AdminTokenPayload } from '../utils/jwt';
declare global {
    namespace Express {
        interface Request {
            admin?: AdminTokenPayload;
        }
    }
}
/**
 * Middleware to require authentication
 */
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to require SUPER_ADMIN role
 */
export declare function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to require either SUPER_ADMIN or MANAGER role
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
/**
 * Optional authentication - sets req.admin if token valid, but doesn't reject
 */
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=authMiddleware.d.ts.map