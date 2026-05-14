#!/usr/bin/env tsx
/**
 * add-user-profile-fields.ts — Migration script for user profile fields
 *
 * Usage:
 *   npx tsx src/scripts/add-user-profile-fields.ts
 *
 * What it does:
 *   1. Adds `email`, `phone`, `profile_complete` columns to the `users` table
 *      (safe to run multiple times — uses IF NOT EXISTS guards).
 *   2. Sets `profile_complete = false` for all existing users who have no email
 *      or phone on record, flagging them to complete their profile on next login.
 *   3. Prints a summary report.
 */

import { prisma } from '../db/prisma';

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   WLD2Mpesa — Add User Profile Fields Migration        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // ── Step 1: Add columns (idempotent) ─────────────────────────────────────
    console.log('► Step 1: Adding columns to users table (if not exists)...');

    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'email'
            ) THEN
                ALTER TABLE "users" ADD COLUMN "email" TEXT;
                RAISE NOTICE 'Added column: email';
            ELSE
                RAISE NOTICE 'Column email already exists — skipped.';
            END IF;
        END $$;
    `);

    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'phone'
            ) THEN
                ALTER TABLE "users" ADD COLUMN "phone" TEXT;
                RAISE NOTICE 'Added column: phone';
            ELSE
                RAISE NOTICE 'Column phone already exists — skipped.';
            END IF;
        END $$;
    `);

    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'profile_complete'
            ) THEN
                ALTER TABLE "users" ADD COLUMN "profile_complete" BOOLEAN NOT NULL DEFAULT false;
                RAISE NOTICE 'Added column: profile_complete';
            ELSE
                RAISE NOTICE 'Column profile_complete already exists — skipped.';
            END IF;
        END $$;
    `);

    // ── Step 2: Add index on email ────────────────────────────────────────────
    console.log('► Step 2: Creating index on users(email) if not exists...');
    await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'users' AND indexname = 'users_email_idx'
            ) THEN
                CREATE INDEX "users_email_idx" ON "users"("email");
                RAISE NOTICE 'Created index: users_email_idx';
            ELSE
                RAISE NOTICE 'Index users_email_idx already exists — skipped.';
            END IF;
        END $$;
    `);

    // ── Step 3: Report on existing users (raw SQL — Prisma client not yet regenerated) ──
    console.log('► Step 3: Auditing existing users...');

    const [totalRes] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "users"`
    );
    const totalUsers = Number(totalRes.count);

    const [verifiedRes] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "users" WHERE is_verified = true`
    );
    const verifiedUsers = Number(verifiedRes.count);

    const [needsProfileRes] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "users"
         WHERE is_verified = true AND (email IS NULL OR phone IS NULL)`
    );
    const needsProfile = Number(needsProfileRes.count);

    // ── Step 4: Ensure profile_complete = false for users missing email/phone ──
    console.log('► Step 4: Ensuring profile_complete = false for users with missing data...');

    const updateResult = await prisma.$executeRawUnsafe(
        `UPDATE "users"
         SET profile_complete = false
         WHERE is_verified = true
           AND (email IS NULL OR phone IS NULL OR full_name IS NULL)
           AND profile_complete = true`
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                   Migration Summary                    ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`  Total users:             ${totalUsers}`);
    console.log(`  Verified users:          ${verifiedUsers}`);
    console.log(`  Need profile completion: ${needsProfile}`);
    console.log(`  Reset profileComplete:   ${updateResult} rows`);
    console.log('\n✅ Migration complete.\n');
    console.log('  Next time these users log in, they will be prompted');
    console.log('  to provide their Name, Email, and Phone Number.\n');
}

main()
    .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
