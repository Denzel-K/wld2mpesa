/**
 * adminService.ts — Admin management service
 *
 * Handles all admin-related database operations including:
 * - Admin CRUD operations
 * - Invitation management
 * - Authentication
 */
export interface CreateAdminInput {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    role: 'SUPER_ADMIN' | 'MANAGER';
}
export interface CreateInvitationInput {
    fullName: string;
    email: string;
    phone?: string;
    role: 'MANAGER';
    invitedById: string;
}
export interface AcceptInvitationInput {
    token: string;
    password: string;
}
/**
 * Create a new admin (used by super-admin script)
 */
export declare function createAdmin(input: CreateAdminInput): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
}>;
/**
 * Find admin by email
 */
export declare function findAdminByEmail(email: string): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    passwordHash: string;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
} | null>;
/**
 * Find admin by ID
 */
export declare function findAdminById(id: string): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    passwordHash: string;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
} | null>;
/**
 * Get all admins (for super-admin management)
 */
export declare function getAllAdmins(): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
}[]>;
/**
 * Update admin status
 */
export declare function updateAdminStatus(adminId: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
}>;
/**
 * Update last login
 */
export declare function updateLastLogin(adminId: string, ipAddress: string): Promise<void>;
/**
 * Create an admin invitation
 */
export declare function createInvitation(input: CreateInvitationInput): Promise<{
    invitedBy: {
        fullName: string;
    };
} & {
    token: string;
    phone: string | null;
    id: string;
    createdAt: Date;
    expiresAt: Date;
    fullName: string;
    email: string;
    role: string;
    acceptedAt: Date | null;
    invitedById: string;
}>;
/**
 * Find invitation by token
 */
export declare function findInvitationByToken(token: string): Promise<({
    invitedBy: {
        fullName: string;
        email: string;
    };
} & {
    token: string;
    phone: string | null;
    id: string;
    createdAt: Date;
    expiresAt: Date;
    fullName: string;
    email: string;
    role: string;
    acceptedAt: Date | null;
    invitedById: string;
}) | null>;
/**
 * Accept an invitation and create admin account
 */
export declare function acceptInvitation(input: AcceptInvitationInput): Promise<{
    phone: string | null;
    id: string;
    status: string;
    createdAt: Date;
    fullName: string;
    email: string;
    updatedAt: Date;
    role: string;
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
}>;
/**
 * Get all invitations (for super-admin)
 */
export declare function getAllInvitations(): Promise<({
    invitedBy: {
        fullName: string;
        email: string;
    };
} & {
    token: string;
    phone: string | null;
    id: string;
    createdAt: Date;
    expiresAt: Date;
    fullName: string;
    email: string;
    role: string;
    acceptedAt: Date | null;
    invitedById: string;
})[]>;
/**
 * Cancel/delete an invitation
 */
export declare function cancelInvitation(invitationId: string): Promise<{
    token: string;
    phone: string | null;
    id: string;
    createdAt: Date;
    expiresAt: Date;
    fullName: string;
    email: string;
    role: string;
    acceptedAt: Date | null;
    invitedById: string;
}>;
/**
 * Clean up expired invitations
 */
export declare function cleanupExpiredInvitations(): Promise<number>;
/**
 * Get admin dashboard statistics
 */
export declare function getAdminStats(): Promise<{
    totalAdmins: number;
    activeAdmins: number;
    totalInvitations: number;
    pendingInvitations: number;
}>;
//# sourceMappingURL=adminService.d.ts.map