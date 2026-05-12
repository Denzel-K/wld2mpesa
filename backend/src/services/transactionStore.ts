import { prisma } from '../db/prisma';
import type { Transaction, TransactionStatus } from '../types';
import type { Transaction as PrismaTransaction } from '../../.generated/postgres_client/client';

/**
 * TransactionStore — Prisma-backed transaction store (PostgreSQL)
 * 
 * Replaces the JSON file implementation while maintaining the same public interface.
 */
class TransactionStore {
  /**
   * Maps a Prisma Transaction model to our domain Transaction interface.
   */
  private mapToDomain(pt: PrismaTransaction): Transaction {
    return {
      id: pt.id,
      status: pt.status as TransactionStatus,
      transactionType: pt.transactionType as 'send' | 'paybill' | 'pochi' | 'till',
      kesAmount: pt.kesAmount,
      tillNumber: pt.tillNumber,
      phoneNumber: pt.phoneNumber,
      accountNumber: pt.accountNumber,
      walletAddress: pt.walletAddress,
      wldAmount: pt.wldAmount,
      feeWld: pt.feeWld,
      feeKes: pt.feeKes,
      wldRate: pt.wldRate,
      payToAddress: pt.payToAddress,
      platformFeeKes: pt.platformFeeKes ?? null,
      safaricomFeeKes: pt.safaricomFeeKes ?? null,
      gasBufferKes: pt.gasBufferKes ?? null,
      bitnobFeeKes: pt.bitnobFeeKes ?? null,
      dexFeeKes: pt.dexFeeKes ?? null,
      netPlatformRevenueKes: pt.netPlatformRevenueKes ?? null,
      txHash: pt.txHash,
      offrampId: pt.offrampId,
      mpesaConversationId: pt.mpesaConversationId,
      mpesaReceiptNumber: pt.mpesaReceiptNumber,
      failureReason: pt.failureReason,
      refundStatus: (pt.refundStatus as any) ?? null,
      refundTxHash: pt.refundTxHash ?? null,
      refundAt: pt.refundAt?.toISOString() ?? null,
      miniKitPayload: pt.miniKitPayload ? JSON.parse(pt.miniKitPayload) : undefined,
      worldIdProof: pt.worldIdProof ? JSON.parse(pt.worldIdProof) : undefined,
      createdAt: pt.createdAt.toISOString(),
      confirmedAt: pt.confirmedAt?.toISOString() ?? null,
      offrampAt: pt.offrampAt?.toISOString() ?? null,
      mpesaSentAt: pt.mpesaSentAt?.toISOString() ?? null,
      settledAt: pt.settledAt?.toISOString() ?? null,
      failedAt: pt.failedAt?.toISOString() ?? null,
      userId: pt.userId,
    };
  }

  async save(tx: Transaction): Promise<void> {
    await prisma.transaction.create({
      data: {
        id: tx.id,
        status: tx.status,
        transactionType: tx.transactionType,
        kesAmount: tx.kesAmount,
        tillNumber: tx.tillNumber,
        phoneNumber: tx.phoneNumber,
        accountNumber: tx.accountNumber,
        walletAddress: tx.walletAddress,
        wldAmount: tx.wldAmount,
        feeWld: tx.feeWld,
        feeKes: tx.feeKes,
        wldRate: tx.wldRate,
        payToAddress: tx.payToAddress,
        platformFeeKes: tx.platformFeeKes ?? null,
        safaricomFeeKes: tx.safaricomFeeKes ?? null,
        gasBufferKes: tx.gasBufferKes ?? null,
        bitnobFeeKes: tx.bitnobFeeKes ?? null,
        dexFeeKes: tx.dexFeeKes ?? null,
        netPlatformRevenueKes: tx.netPlatformRevenueKes ?? null,
        txHash: tx.txHash,
        offrampId: tx.offrampId,
        mpesaConversationId: tx.mpesaConversationId,
        mpesaReceiptNumber: tx.mpesaReceiptNumber,
        failureReason: tx.failureReason,
        refundStatus: tx.refundStatus ?? null,
        refundTxHash: tx.refundTxHash ?? null,
        refundAt: tx.refundAt ? new Date(tx.refundAt) : null,
        miniKitPayload: tx.miniKitPayload ? JSON.stringify(tx.miniKitPayload) : null,
        worldIdProof: tx.worldIdProof ? JSON.stringify(tx.worldIdProof) : null,
        createdAt: new Date(tx.createdAt),
        confirmedAt: tx.confirmedAt ? new Date(tx.confirmedAt) : null,
        offrampAt: tx.offrampAt ? new Date(tx.offrampAt) : null,
        mpesaSentAt: tx.mpesaSentAt ? new Date(tx.mpesaSentAt) : null,
        settledAt: tx.settledAt ? new Date(tx.settledAt) : null,
        failedAt: tx.failedAt ? new Date(tx.failedAt) : null,
        userId: tx.userId,
      },
    });
  }

  async get(id: string): Promise<Transaction | null> {
    const pt = await prisma.transaction.findUnique({
      where: { id },
    });
    return pt ? this.mapToDomain(pt) : null;
  }

  async update(id: string, updates: Partial<Transaction>): Promise<void> {
    const data: any = {};

    // Map non-null keys
    Object.keys(updates).forEach((key) => {
      const val = (updates as any)[key];
      if (val !== undefined) {
        data[key] = val;
      }
    });

    // Map JSON fields
    if (updates.miniKitPayload !== undefined) {
      data.miniKitPayload = updates.miniKitPayload ? JSON.stringify(updates.miniKitPayload) : null;
    }
    if (updates.worldIdProof !== undefined) {
      data.worldIdProof = updates.worldIdProof ? JSON.stringify(updates.worldIdProof) : null;
    }

    // Map Date fields
    if (updates.createdAt) data.createdAt = new Date(updates.createdAt);
    if (updates.confirmedAt !== undefined) data.confirmedAt = updates.confirmedAt ? new Date(updates.confirmedAt) : null;
    if (updates.offrampAt !== undefined) data.offrampAt = updates.offrampAt ? new Date(updates.offrampAt) : null;
    if (updates.mpesaSentAt !== undefined) data.mpesaSentAt = updates.mpesaSentAt ? new Date(updates.mpesaSentAt) : null;
    if (updates.settledAt !== undefined) data.settledAt = updates.settledAt ? new Date(updates.settledAt) : null;
    if (updates.failedAt !== undefined) data.failedAt = updates.failedAt ? new Date(updates.failedAt) : null;
    if (updates.refundStatus !== undefined) data.refundStatus = updates.refundStatus ?? null;
    if (updates.refundTxHash !== undefined) data.refundTxHash = updates.refundTxHash ?? null;
    if (updates.refundAt !== undefined) data.refundAt = updates.refundAt ? new Date(updates.refundAt) : null;

    await prisma.transaction.update({
      where: { id },
      data,
    });
  }

  async getAll(walletAddress?: string): Promise<Transaction[]> {
    const records = await prisma.transaction.findMany({
      where: walletAddress ? { walletAddress } : {},
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50
    });
    return records.map((pt) => this.mapToDomain(pt));
  }

  async count(): Promise<number> {
    return prisma.transaction.count();
  }
}

export const transactionStore = new TransactionStore();
