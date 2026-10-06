"use strict";
/**
 * adminService.ts — Admin management service
 *
 * Handles all admin-related database operations including:
 * - Admin CRUD operations
 * - Invitation management
 * - Authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdmin = createAdmin;
exports.findAdminByEmail = findAdminByEmail;
exports.findAdminById = findAdminById;
exports.getAllAdmins = getAllAdmins;
exports.updateAdminStatus = updateAdminStatus;
exports.updateLastLogin = updateLastLogin;
exports.createInvitation = createInvitation;
exports.findInvitationByToken = findInvitationByToken;
exports.acceptInvitation = acceptInvitation;
exports.getAllInvitations = getAllInvitations;
exports.cancelInvitation = cancelInvitation;
exports.cleanupExpiredInvitations = cleanupExpiredInvitations;
exports.getAdminStats = getAdminStats;
const prisma_1 = require("../db/prisma");
const jwt_1 = require("../utils/jwt");
const config_1 = require("../config");
const emailService_1 = require("./emailService");
// Admin CRUD Operations
/**
 * Create a new admin (used by super-admin script)
 */
async function createAdmin(input) {
    // Check if email already exists
    const existing = await prisma_1.prisma.admin.findUnique({
        where: { email: input.email },
    });
    if (existing) {
        throw new Error('Email already registered');
    }
    const passwordHash = await (0, jwt_1.hashPassword)(input.password);
    const admin = await prisma_1.prisma.admin.create({
        data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            passwordHash,
            role: input.role,
            status: 'ACTIVE',
        },
    });
    // Return without password hash
    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
}
/**
 * Find admin by email
 */
async function findAdminByEmail(email) {
    return prisma_1.prisma.admin.findUnique({
        where: { email },
    });
}
/**
 * Find admin by ID
 */
async function findAdminById(id) {
    return prisma_1.prisma.admin.findUnique({
        where: { id },
    });
}
/**
 * Get all admins (for super-admin management)
 */
async function getAllAdmins() {
    const admins = await prisma_1.prisma.admin.findMany({
        orderBy: { createdAt: 'desc' },
    });
    // Remove password hashes
    return admins.map(admin => {
        const { passwordHash: _, ...adminWithoutPassword } = admin;
        return adminWithoutPassword;
    });
}
/**
 * Update admin status
 */
async function updateAdminStatus(adminId, status) {
    const admin = await prisma_1.prisma.admin.update({
        where: { id: adminId },
        data: { status },
    });
    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
}
/**
 * Update last login
 */
async function updateLastLogin(adminId, ipAddress) {
    await prisma_1.prisma.admin.update({
        where: { id: adminId },
        data: {
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
        },
    });
}
// Invitation Operations
/**
 * Create an admin invitation
 */
async function createInvitation(input) {
    // Check if email already has an active invitation
    const existingInvitation = await prisma_1.prisma.adminInvitation.findFirst({
        where: {
            email: input.email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
    if (existingInvitation) {
        throw new Error('An active invitation already exists for this email');
    }
    // Check if email is already registered as admin
    const existingAdmin = await prisma_1.prisma.admin.findUnique({
        where: { email: input.email },
    });
    if (existingAdmin) {
        throw new Error('Email is already registered as an admin');
    }
    const token = (0, jwt_1.generateSecureToken)(48);
    const expiresAt = (0, jwt_1.calculateExpiryDate)(config_1.config.INVITATION_EXPIRY_HOURS);
    const invitation = await prisma_1.prisma.adminInvitation.create({
        data: {
            email: input.email,
            fullName: input.fullName,
            phone: input.phone,
            role: input.role,
            token,
            expiresAt,
            invitedById: input.invitedById,
        },
        include: {
            invitedBy: {
                select: {
                    fullName: true,
                },
            },
        },
    });
    // Send invitation email
    const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:4000';
    const inviteLink = `${websiteUrl}/admin-invite?token=${token}`;
    const emailResult = await (0, emailService_1.sendAdminInvitation)({
        to: input.email,
        name: input.fullName,
        invitedBy: invitation.invitedBy.fullName,
        inviteLink,
        expiresAt,
    });
    if (!emailResult.success) {
        // Delete invitation if email failed
        await prisma_1.prisma.adminInvitation.delete({ where: { id: invitation.id } });
        throw new Error(`Failed to send invitation email: ${emailResult.error}`);
    }
    return invitation;
}
/**
 * Find invitation by token
 */
async function findInvitationByToken(token) {
    return prisma_1.prisma.adminInvitation.findUnique({
        where: { token },
        include: {
            invitedBy: {
                select: {
                    fullName: true,
                    email: true,
                },
            },
        },
    });
}
/**
 * Accept an invitation and create admin account
 */
async function acceptInvitation(input) {
    const invitation = await prisma_1.prisma.adminInvitation.findUnique({
        where: { token: input.token },
    });
    if (!invitation) {
        throw new Error('Invalid invitation token');
    }
    if (invitation.acceptedAt) {
        throw new Error('Invitation has already been accepted');
    }
    if (invitation.expiresAt < new Date()) {
        throw new Error('Invitation has expired');
    }
    // Check if email is already registered
    const existingAdmin = await prisma_1.prisma.admin.findUnique({
        where: { email: invitation.email },
    });
    if (existingAdmin) {
        throw new Error('Email is already registered');
    }
    // Create admin in transaction
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        // Create the admin
        const passwordHash = await (0, jwt_1.hashPassword)(input.password);
        const admin = await tx.admin.create({
            data: {
                fullName: invitation.fullName,
                email: invitation.email,
                phone: invitation.phone,
                passwordHash,
                role: invitation.role,
                status: 'ACTIVE',
            },
        });
        // Mark invitation as accepted
        await tx.adminInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
        });
        return admin;
    });
    const { passwordHash: _, ...adminWithoutPassword } = result;
    return adminWithoutPassword;
}
/**
 * Get all invitations (for super-admin)
 */
async function getAllInvitations() {
    return prisma_1.prisma.adminInvitation.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            invitedBy: {
                select: {
                    fullName: true,
                    email: true,
                },
            },
        },
    });
}
/**
 * Cancel/delete an invitation
 */
async function cancelInvitation(invitationId) {
    return prisma_1.prisma.adminInvitation.delete({
        where: { id: invitationId },
    });
}
/**
 * Clean up expired invitations
 */
async function cleanupExpiredInvitations() {
    const result = await prisma_1.prisma.adminInvitation.deleteMany({
        where: {
            expiresAt: { lt: new Date() },
            acceptedAt: null,
        },
    });
    return result.count;
}
// Statistics
/**
 * Get admin dashboard statistics
 */
async function getAdminStats() {
    const [totalAdmins, activeAdmins, totalInvitations, pendingInvitations,] = await Promise.all([
        prisma_1.prisma.admin.count(),
        prisma_1.prisma.admin.count({ where: { status: 'ACTIVE' } }),
        prisma_1.prisma.adminInvitation.count(),
        prisma_1.prisma.adminInvitation.count({
            where: {
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
        }),
    ]);
    return {
        totalAdmins,
        activeAdmins,
        totalInvitations,
        pendingInvitations,
    };
}
//# sourceMappingURL=adminService.js.map