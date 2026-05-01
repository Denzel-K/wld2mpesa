-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "refund_at" TIMESTAMP(3),
ADD COLUMN     "refund_status" TEXT,
ADD COLUMN     "refund_tx_hash" TEXT;
