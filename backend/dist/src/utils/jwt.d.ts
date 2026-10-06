/**
 * jwt.ts — JWT utilities for admin authentication
 */
export interface AdminTokenPayload {
    adminId: string;
    email: string;
    role: 'SUPER_ADMIN' | 'MANAGER';
    iat?: number;
    exp?: number;
}
/**
 * Hash a password using bcrypt
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Compare a plain password with a hash
 */
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
/**
 * Generate a JWT token for an admin
 */
export declare function generateAdminToken(adminId: string, email: string, role: 'SUPER_ADMIN' | 'MANAGER'): string;
/**
 * Verify and decode a JWT token
 */
export declare function verifyAdminToken(token: string): AdminTokenPayload;
/**
 * Decode a JWT token without verification (for debugging)
 */
export declare function decodeAdminToken(token: string): AdminTokenPayload | null;
/**
 * Generate a secure random token (for invitations)
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Calculate token expiration date
 */
export declare function calculateExpiryDate(hours: number): Date;
//# sourceMappingURL=jwt.d.ts.map