/**
 * db-audit.ts — Database Audit Script
 *
 * Reads all transactions from the database and prints a structured report.
 * Focuses on refund tracking, stuck transactions, and data integrity issues.
 *
 * Usage:
 *   npx tsx src/scripts/db-audit.ts              # full report
 *   npx tsx src/scripts/db-audit.ts --refunds    # refunds only
 *   npx tsx src/scripts/db-audit.ts --stuck      # stuck pipeline only
 *   npx tsx src/scripts/db-audit.ts --failed     # failed only
 *   npx tsx src/scripts/db-audit.ts --fix-fake   # correct stale REFUNDED records that have no refundTxHash
 */
import 'dotenv/config';
//# sourceMappingURL=db-audit.d.ts.map