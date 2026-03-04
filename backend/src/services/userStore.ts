import { prisma } from '../db/prisma';
import type { User } from '../types';
import { User as PrismaUser } from '../generated/prisma/client';

/**
 * UserStore — User management via Prisma (SQLite)
 */
class UserStore {
    /**
     * Maps a Prisma User model to our domain User interface.
     */
    private mapToDomain(pu: PrismaUser): User {
        return {
            id: pu.id,
            walletAddress: pu.walletAddress,
            nullifierHash: pu.nullifierHash,
            verificationLevel: pu.verificationLevel,
            isVerified: pu.isVerified,
            onboarded: pu.onboarded,
            createdAt: pu.createdAt.toISOString(),
            lastSeenAt: pu.lastSeenAt.toISOString(),
        };
    }

    async findByWallet(walletAddress: string): Promise<User | null> {
        const pu = await prisma.user.findUnique({
            where: { walletAddress },
        });
        return pu ? this.mapToDomain(pu) : null;
    }

    async findByNullifier(nullifierHash: string): Promise<User | null> {
        const pu = await prisma.user.findUnique({
            where: { nullifierHash },
        });
        return pu ? this.mapToDomain(pu) : null;
    }

    async createOrUpdate(data: {
        walletAddress: string;
        nullifierHash?: string;
        verificationLevel?: string;
        isVerified?: boolean;
        onboarded?: boolean;
    }): Promise<User> {
        const pu = await prisma.user.upsert({
            where: { walletAddress: data.walletAddress },
            update: {
                ...data,
                lastSeenAt: new Date(),
            },
            create: {
                ...data,
                lastSeenAt: new Date(),
            },
        });
        return this.mapToDomain(pu);
    }

    async markVerified(walletAddress: string, nullifierHash: string, level: string): Promise<void> {
        await prisma.user.update({
            where: { walletAddress },
            data: {
                nullifierHash,
                verificationLevel: level,
                isVerified: true,
            },
        });
    }

    async markOnboarded(walletAddress: string): Promise<void> {
        await prisma.user.update({
            where: { walletAddress },
            data: { onboarded: true },
        });
    }
}

export const userStore = new UserStore();
