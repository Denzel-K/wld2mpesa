-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet_address" TEXT NOT NULL,
    "nullifier_hash" TEXT,
    "verification_level" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "transaction_type" TEXT NOT NULL,
    "kes_amount" REAL NOT NULL,
    "wld_amount" TEXT NOT NULL,
    "fee_wld" TEXT NOT NULL,
    "fee_kes" REAL NOT NULL,
    "wld_rate" TEXT NOT NULL,
    "till_number" TEXT,
    "phone_number" TEXT,
    "account_number" TEXT,
    "wallet_address" TEXT NOT NULL,
    "pay_to_address" TEXT NOT NULL,
    "tx_hash" TEXT,
    "offramp_id" TEXT,
    "mpesa_conversation_id" TEXT,
    "mpesa_receipt_number" TEXT,
    "failure_reason" TEXT,
    "minikit_payload" TEXT,
    "world_id_proof" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" DATETIME,
    "offramp_at" DATETIME,
    "mpesa_sent_at" DATETIME,
    "settled_at" DATETIME,
    "failed_at" DATETIME,
    "user_id" TEXT,
    CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rate_cache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wld_price_kes" REAL NOT NULL,
    "wld_price_usd" REAL NOT NULL,
    "usd_kes_rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'coingecko',
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_payload" TEXT NOT NULL,
    "processed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT,
    CONSTRAINT "webhook_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_nullifier_hash_key" ON "users"("nullifier_hash");

-- CreateIndex
CREATE INDEX "transactions_wallet_address_idx" ON "transactions"("wallet_address");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "webhook_events_transaction_id_idx" ON "webhook_events"("transaction_id");
