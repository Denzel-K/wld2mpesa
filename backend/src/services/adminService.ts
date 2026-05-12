/**
 * adminService.ts — Admin management service
 *
 * Handles all admin-related database operations including:
 * - Admin CRUD operations
 * - Invitation management
 * - Authentication
 */

import { prisma } from '../db/prisma';
import { hashPassword, generateSecureToken, calculateExpiryDate } from '../utils/jwt';
import { config } from '../config';
import { sendAdminInvitation } from './emailService';

// Types
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
  role: 'MANAGER'; // Only managers can be invited
  invitedById: string;
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
}

// Admin CRUD Operations

/**
 * Create a new admin (used by super-admin script)
 */
export async function createAdmin(input: CreateAdminInput) {
  // Check if email already exists
  const existing = await prisma.admin.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new Error('Email already registered');
  }

  const passwordHash = await hashPassword(input.password);

  const admin = await prisma.admin.create({
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
export async function findAdminByEmail(email: string) {
  return prisma.admin.findUnique({
    where: { email },
  });
}

/**
 * Find admin by ID
 */
export async function findAdminById(id: string) {
  return prisma.admin.findUnique({
    where: { id },
  });
}

/**
 * Get all admins (for super-admin management)
 */
export async function getAllAdmins() {
  const admins = await prisma.admin.findMany({
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
export async function updateAdminStatus(adminId: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE') {
  const admin = await prisma.admin.update({
    where: { id: adminId },
    data: { status },
  });

  const { passwordHash: _, ...adminWithoutPassword } = admin;
  return adminWithoutPassword;
}

/**
 * Update last login
 */
export async function updateLastLogin(adminId: string, ipAddress: string) {
  await prisma.admin.update({
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
export async function createInvitation(input: CreateInvitationInput) {
  // Check if email already has an active invitation
  const existingInvitation = await prisma.adminInvitation.findFirst({
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
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: input.email },
  });

  if (existingAdmin) {
    throw new Error('Email is already registered as an admin');
  }

  const token = generateSecureToken(48);
  const expiresAt = calculateExpiryDate(config.INVITATION_EXPIRY_HOURS);

  const invitation = await prisma.adminInvitation.create({
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

  const emailResult = await sendAdminInvitation({
    to: input.email,
    name: input.fullName,
    invitedBy: invitation.invitedBy.fullName,
    inviteLink,
    expiresAt,
  });

  if (!emailResult.success) {
    // Delete invitation if email failed
    await prisma.adminInvitation.delete({ where: { id: invitation.id } });
    throw new Error(`Failed to send invitation email: ${emailResult.error}`);
  }

  return invitation;
}

/**
 * Find invitation by token
 */
export async function findInvitationByToken(token: string) {
  return prisma.adminInvitation.findUnique({
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
export async function acceptInvitation(input: AcceptInvitationInput) {
  const invitation = await prisma.adminInvitation.findUnique({
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
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: invitation.email },
  });

  if (existingAdmin) {
    throw new Error('Email is already registered');
  }

  // Create admin in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the admin
    const passwordHash = await hashPassword(input.password);

    const admin = await tx.admin.create({
      data: {
        fullName: invitation.fullName,
        email: invitation.email,
        phone: invitation.phone,
        passwordHash,
        role: invitation.role as 'MANAGER',
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
export async function getAllInvitations() {
  return prisma.adminInvitation.findMany({
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
export async function cancelInvitation(invitationId: string) {
  return prisma.adminInvitation.delete({
    where: { id: invitationId },
  });
}

/**
 * Clean up expired invitations
 */
export async function cleanupExpiredInvitations() {
  const result = await prisma.adminInvitation.deleteMany({
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
export async function getAdminStats() {
  const [
    totalAdmins,
    activeAdmins,
    totalInvitations,
    pendingInvitations,
  ] = await Promise.all([
    prisma.admin.count(),
    prisma.admin.count({ where: { status: 'ACTIVE' } }),
    prisma.adminInvitation.count(),
    prisma.adminInvitation.count({
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
