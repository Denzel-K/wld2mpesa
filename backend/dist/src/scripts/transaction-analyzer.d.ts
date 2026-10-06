/**
 * transaction-analyzer.ts — Advanced Transaction Analysis & Pipeline Diagnostics
 *
 * Analyzes past transactions and attempted refunds to identify:
 * - Root causes of failures
 * - Patterns in stuck transactions
 * - Refund failures and recovery options
 * - Pipeline bottlenecks and enhancement opportunities
 * - Integration health (World Chain, Bitnob, M-Pesa)
 *
 * Usage:
 *   npx tsx src/scripts/transaction-analyzer.ts              # Full analysis
 *   npx tsx src/scripts/transaction-analyzer.ts --fix      # Auto-fix recoverable issues
 *   npx tsx src/scripts/transaction-analyzer.ts --report   # Generate JSON report
 *   npx tsx src/scripts/transaction-analyzer.ts --stuck    # Focus on stuck transactions
 */
import 'dotenv/config';
//# sourceMappingURL=transaction-analyzer.d.ts.map