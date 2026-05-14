-- AlterTable: Rename name -> wld_username, add full_name, email, phone, profile_complete
-- The existing "name" column (extracted from WLD account) becomes wld_username.
ALTER TABLE "users" RENAME COLUMN "name" TO "wld_username";

ALTER TABLE "users" ADD COLUMN "full_name" TEXT;
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "profile_complete" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex for email lookups
CREATE INDEX "users_email_idx" ON "users"("email");
