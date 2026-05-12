-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "bitnob_fee_kes" DOUBLE PRECISION,
ADD COLUMN     "dex_fee_kes" DOUBLE PRECISION,
ADD COLUMN     "gas_buffer_kes" DOUBLE PRECISION,
ADD COLUMN     "net_platform_revenue_kes" DOUBLE PRECISION,
ADD COLUMN     "platform_fee_kes" DOUBLE PRECISION,
ADD COLUMN     "safaricom_fee_kes" DOUBLE PRECISION;
