import type { Transaction } from '../types';
/**
 * TransactionStore — Prisma-backed transaction store (PostgreSQL)
 *
 * Replaces the JSON file implementation while maintaining the same public interface.
 */
declare class TransactionStore {
    /**
     * Maps a Prisma Transaction model to our domain Transaction interface.
     */
    private mapToDomain;
    save(tx: Transaction): Promise<void>;
    get(id: string): Promise<Transaction | null>;
    update(id: string, updates: Partial<Transaction>): Promise<void>;
    getAll(walletAddress?: string): Promise<Transaction[]>;
    count(): Promise<number>;
}
export declare const transactionStore: TransactionStore;
export {};
//# sourceMappingURL=transactionStore.d.ts.map