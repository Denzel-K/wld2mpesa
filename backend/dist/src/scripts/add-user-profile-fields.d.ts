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
export {};
//# sourceMappingURL=add-user-profile-fields.d.ts.map