import type { User } from '../types';
/**
 * UserStore — User management via Prisma (PostgreSQL)
 */
declare class UserStore {
    /**
     * Maps a Prisma User model to our domain User interface.
     */
    private mapToDomain;
    findByWallet(walletAddress: string): Promise<User | null>;
    findByNullifier(nullifierHash: string): Promise<User | null>;
    createOrUpdate(data: {
        walletAddress: string;
        nullifierHash?: string;
        wldUsername?: string;
        fullName?: string;
        email?: string;
        phone?: string;
        profileComplete?: boolean;
        verificationLevel?: string;
        isVerified?: boolean;
        onboarded?: boolean;
    }): Promise<User>;
    updateProfile(walletAddress: string, data: {
        fullName: string;
        email: string;
        phone: string;
    }): Promise<User>;
    markVerified(walletAddress: string, nullifierHash: string, level: string): Promise<void>;
    markOnboarded(walletAddress: string): Promise<void>;
}
export declare const userStore: UserStore;
export {};
//# sourceMappingURL=userStore.d.ts.map