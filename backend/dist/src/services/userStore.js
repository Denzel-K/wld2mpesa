"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStore = void 0;
const prisma_1 = require("../db/prisma");
/**
 * UserStore — User management via Prisma (PostgreSQL)
 */
class UserStore {
    /**
     * Maps a Prisma User model to our domain User interface.
     */
    mapToDomain(pu) {
        return {
            id: pu.id,
            walletAddress: pu.walletAddress,
            nullifierHash: pu.nullifierHash,
            wldUsername: pu.wldUsername ?? null,
            fullName: pu.fullName ?? null,
            email: pu.email ?? null,
            phone: pu.phone ?? null,
            profileComplete: pu.profileComplete ?? false,
            verificationLevel: pu.verificationLevel,
            isVerified: pu.isVerified,
            onboarded: pu.onboarded,
            createdAt: pu.createdAt.toISOString(),
            lastSeenAt: pu.lastSeenAt.toISOString(),
        };
    }
    async findByWallet(walletAddress) {
        const pu = await prisma_1.prisma.user.findUnique({
            where: { walletAddress },
        });
        return pu ? this.mapToDomain(pu) : null;
    }
    async findByNullifier(nullifierHash) {
        const pu = await prisma_1.prisma.user.findUnique({
            where: { nullifierHash },
        });
        return pu ? this.mapToDomain(pu) : null;
    }
    async createOrUpdate(data) {
        const pu = await prisma_1.prisma.user.upsert({
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
    async updateProfile(walletAddress, data) {
        const pu = await prisma_1.prisma.user.update({
            where: { walletAddress },
            data: {
                ...data,
                profileComplete: true,
                lastSeenAt: new Date(),
            },
        });
        return this.mapToDomain(pu);
    }
    async markVerified(walletAddress, nullifierHash, level) {
        await prisma_1.prisma.user.update({
            where: { walletAddress },
            data: {
                nullifierHash,
                verificationLevel: level,
                isVerified: true,
            },
        });
    }
    async markOnboarded(walletAddress) {
        await prisma_1.prisma.user.update({
            where: { walletAddress },
            data: { onboarded: true },
        });
    }
}
exports.userStore = new UserStore();
//# sourceMappingURL=userStore.js.map