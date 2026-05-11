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
import { prisma } from '../db/prisma';
import { config } from '../config';

// ─── ANSI Colour Helpers ──────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const icon = {
  check: '✓',
  cross: '✗',
  warn: '⚠',
  info: 'ℹ',
  rocket: '🚀',
  chain: '⛓',
  money: '💰',
  retry: '🔄',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisReport {
  generatedAt: string;
  summary: {
    totalTransactions: number;
    byStatus: Record<string, number>;
    totalWldVolume: string;
    atRiskWld: string;
  };
  failures: FailureAnalysis[];
  stuck: StuckAnalysis[];
  refunds: RefundAnalysis[];
  pipelineHealth: PipelineHealth;
  recommendations: Recommendation[];
}

interface FailureAnalysis {
  transactionId: string;
  status: string;
  failureReason: string | null;
  failedAt: Date | null;
  wldAmount: string;
  stageReached: string;
  rootCause: RootCause;
  recoverable: boolean;
  suggestedAction: string;
}

interface StuckAnalysis {
  transactionId: string;
  status: string;
  stuckAt: Date;
  durationMinutes: number;
  wldAmount: string;
  hasTxHash: boolean;
  hasOfframpId: boolean;
  likelyCause: string;
  autoRecoverable: boolean;
}

interface RefundAnalysis {
  transactionId: string;
  refundStatus: string | null;
  refundTxHash: string | null;
  wldAmount: string;
  failedAt: Date | null;
  legitimacy: 'VALID' | 'SUSPICIOUS' | 'INVALID';
  issue: string | null;
  fixable: boolean;
}

interface PipelineHealth {
  worldChain: { status: 'HEALTHY' | 'DEGRADED' | 'UNKNOWN'; notes: string };
  bitnob: { status: 'HEALTHY' | 'DEGRADED' | 'UNKNOWN'; notes: string };
  mpesa: { status: 'HEALTHY' | 'DEGRADED' | 'UNKNOWN'; notes: string };
}

interface Recommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'REFUND' | 'PIPELINE' | 'INTEGRATION' | 'MONITORING';
  title: string;
  description: string;
  action: string;
  affectedTransactions?: string[];
}

type RootCause =
  | 'BLOCKCHAIN_CONFIRMATION_TIMEOUT'
  | 'DEX_SWAP_FAILURE'
  | 'BITNOB_PAYOUT_FAILURE'
  | 'BITNOB_TIMEOUT'
  | 'MPESA_DISBURSEMENT_FAILURE'
  | 'USER_CANCELLED'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'UNKNOWN'
  | 'REFUND_FAILED_ONCHAIN'
  | 'REFUND_INSUFFICIENT_FUNDS'
  | 'SIMULATION_STUB';

// ─── Helper Functions ─────────────────────────────────────────────────────────

function fmt(date: Date | null | undefined): string {
  if (!date) return c.dim + 'N/A' + c.reset;
  return new Date(date).toLocaleString('en-KE', { hour12: false });
}

function shortId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 16)}…` : id;
}

function wld(n: string | number): string {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(val) ? '0.0000' : val.toFixed(4);
}

function tag(color: string, label: string): string {
  return `${color}${c.bold}[${label}]${c.reset}`;
}

// ─── Root Cause Analysis Engine ───────────────────────────────────────────────

function analyzeRootCause(tx: any): { cause: RootCause; recoverable: boolean; action: string } {
  const status = tx.status;
  const reason = tx.failureReason || '';
  const hasTxHash = !!tx.txHash;
  const hasOfframpId = !!tx.offrampId;

  // Simulation stub detection (from old code)
  if (tx.refundStatus === 'REFUNDED' && !tx.refundTxHash) {
    return {
      cause: 'SIMULATION_STUB',
      recoverable: true,
      action: 'Reset to REFUND_FAILED and allow retry via Conflict Resolution',
    };
  }

  // User cancelled
  if (reason.includes('Cancelled by user') || reason.includes('cancelled')) {
    return {
      cause: 'USER_CANCELLED',
      recoverable: false,
      action: 'No action needed - user intentionally cancelled',
    };
  }

  // Blockchain issues
  if (status === 'PENDING_CONFIRMATION' && hasTxHash) {
    return {
      cause: 'BLOCKCHAIN_CONFIRMATION_TIMEOUT',
      recoverable: true,
      action: 'Retry pipeline to re-check transaction status',
    };
  }

  if (reason.includes('blockchain') || reason.includes('confirmation') || reason.includes('World Chain')) {
    return {
      cause: 'BLOCKCHAIN_CONFIRMATION_TIMEOUT',
      recoverable: hasTxHash,
      action: hasTxHash ? 'Retry pipeline' : 'Request refund if WLD was sent',
    };
  }

  // DEX Swap issues
  if (status === 'CONFIRMED' && !hasOfframpId && hasTxHash) {
    return {
      cause: 'DEX_SWAP_FAILURE',
      recoverable: true,
      action: 'Retry pipeline - swap can be retried or skipped with existing liquidity',
    };
  }

  // Bitnob issues
  if (reason.includes('Bitnob') || reason.includes('payout') || reason.includes('off-ramp')) {
    if (reason.includes('timeout')) {
      return {
        cause: 'BITNOB_TIMEOUT',
        recoverable: true,
        action: 'Check Bitnob dashboard for payout status, then mark settled or refund',
      };
    }
    return {
      cause: 'BITNOB_PAYOUT_FAILURE',
      recoverable: true,
      action: 'Retry pipeline or initiate refund',
    };
  }

  // M-Pesa issues
  if (reason.includes('M-Pesa') || reason.includes('MPESA') || reason.includes('Daraja')) {
    return {
      cause: 'MPESA_DISBURSEMENT_FAILURE',
      recoverable: hasOfframpId,
      action: hasOfframpId ? 'Check Bitnob payout status' : 'Refund WLD to user',
    };
  }

  // Refund specific issues
  if (tx.refundStatus === 'REFUND_FAILED') {
    if (!config.ADMIN_PRIVATE_KEY) {
      return {
        cause: 'REFUND_INSUFFICIENT_FUNDS',
        recoverable: false,
        action: 'Configure ADMIN_PRIVATE_KEY to enable refunds',
      };
    }
    return {
      cause: 'REFUND_FAILED_ONCHAIN',
      recoverable: true,
      action: 'Manual refund required - check gas availability and retry',
    };
  }

  // Liquidity issues
  if (reason.includes('liquidity') || reason.includes('Insufficient')) {
    return {
      cause: 'INSUFFICIENT_LIQUIDITY',
      recoverable: true,
      action: 'Add USDC liquidity to backend wallet and retry',
    };
  }

  return {
    cause: 'UNKNOWN',
    recoverable: hasTxHash,
    action: hasTxHash ? 'Manual investigation required' : 'No WLD at risk',
  };
}

// ─── Analysis Functions ───────────────────────────────────────────────────────

async function analyzeFailures(txns: any[]): Promise<FailureAnalysis[]> {
  const failed = txns.filter((t) => t.status === 'FAILED');
  const analyses: FailureAnalysis[] = [];

  for (const tx of failed) {
    const stageReached = getStageReached(tx);
    const analysis = analyzeRootCause(tx);

    analyses.push({
      transactionId: tx.id,
      status: tx.status,
      failureReason: tx.failureReason,
      failedAt: tx.failedAt,
      wldAmount: wld(tx.wldAmount),
      stageReached,
      rootCause: analysis.cause,
      recoverable: analysis.recoverable,
      suggestedAction: analysis.action,
    });
  }

  return analyses;
}

function getStageReached(tx: any): string {
  if (tx.settledAt) return 'SETTLED';
  if (tx.mpesaSentAt) return 'MPESA_SENT';
  if (tx.offrampId) return 'OFFRAMP_INITIATED';
  if (tx.confirmedAt) return 'CONFIRMED';
  return 'PENDING_CONFIRMATION';
}

async function analyzeStuckTransactions(txns: any[]): Promise<StuckAnalysis[]> {
  const STUCK_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
  const now = Date.now();
  const stuck = txns.filter((t) => STUCK_STATUSES.includes(t.status));

  return stuck.map((tx) => {
    const stuckAt = new Date(tx.createdAt).getTime();
    const durationMinutes = Math.floor((now - stuckAt) / 60000);
    const hasTxHash = !!tx.txHash;
    const hasOfframpId = !!tx.offrampId;

    let likelyCause = 'Unknown';
    let autoRecoverable = false;

    if (tx.status === 'PENDING_CONFIRMATION' && durationMinutes > 10) {
      likelyCause = 'Blockchain confirmation delayed or failed';
      autoRecoverable = hasTxHash;
    } else if (tx.status === 'CONFIRMED' && durationMinutes > 5) {
      likelyCause = 'DEX swap or liquidity rebalancing stuck';
      autoRecoverable = true;
    } else if (tx.status === 'OFFRAMP_INITIATED' && durationMinutes > 15) {
      likelyCause = 'Bitnob payout taking longer than expected';
      autoRecoverable = true; // Can poll and check
    } else if (tx.status === 'MPESA_SENT' && durationMinutes > 10) {
      likelyCause = 'M-Pesa callback not received';
      autoRecoverable = true; // Can check via API
    }

    return {
      transactionId: tx.id,
      status: tx.status,
      stuckAt: new Date(tx.createdAt),
      durationMinutes,
      wldAmount: wld(tx.wldAmount),
      hasTxHash,
      hasOfframpId,
      likelyCause,
      autoRecoverable,
    };
  });
}

async function analyzeRefunds(txns: any[]): Promise<RefundAnalysis[]> {
  const refunds = txns.filter((t) => t.refundStatus != null || t.status === 'FAILED');
  const analyses: RefundAnalysis[] = [];

  for (const tx of refunds) {
    let legitimacy: 'VALID' | 'SUSPICIOUS' | 'INVALID' = 'VALID';
    let issue: string | null = null;
    let fixable = false;

    // Fake refund detection
    if (tx.refundStatus === 'REFUNDED' && !tx.refundTxHash) {
      legitimacy = 'INVALID';
      issue = 'Marked REFUNDED but no on-chain transaction hash - simulation stub';
      fixable = true;
    }

    // Suspicious patterns
    else if (tx.refundStatus === 'REFUNDED' && tx.refundTxHash === 'N/A') {
      legitimacy = 'SUSPICIOUS';
      issue = 'Refund marked with placeholder hash';
      fixable = true;
    }

    // Failed refund with no WLD sent
    else if (tx.refundStatus === 'REFUND_FAILED' && !tx.txHash) {
      legitimacy = 'INVALID';
      issue = 'Refund attempted but WLD was never sent - no refund needed';
      fixable = true;
    }

    // Legitimate failed refund
    else if (tx.refundStatus === 'REFUND_FAILED' && tx.txHash) {
      legitimacy = 'VALID';
      issue = 'On-chain refund failed - requires manual intervention';
      fixable = config.ADMIN_PRIVATE_KEY ? true : false;
    }

    analyses.push({
      transactionId: tx.id,
      refundStatus: tx.refundStatus,
      refundTxHash: tx.refundTxHash,
      wldAmount: wld(tx.wldAmount),
      failedAt: tx.failedAt,
      legitimacy,
      issue,
      fixable,
    });
  }

  return analyses;
}

async function assessPipelineHealth(txns: any[]): Promise<PipelineHealth> {
  const recentTxns = txns.filter((t) => {
    const age = Date.now() - new Date(t.createdAt).getTime();
    return age < 7 * 24 * 60 * 60 * 1000; // Last 7 days
  });

  // World Chain health
  const blockchainFailures = recentTxns.filter(
    (t) => t.status === 'FAILED' && (t.failureReason?.includes('blockchain') || t.status === 'PENDING_CONFIRMATION')
  ).length;
  const blockchainSuccess = recentTxns.filter((t) => t.confirmedAt && t.status !== 'FAILED').length;
  const blockchainRate = blockchainSuccess / (blockchainSuccess + blockchainFailures + 1);

  // Bitnob health
  const bitnobFailures = recentTxns.filter(
    (t) => t.status === 'FAILED' && t.failureReason?.includes('Bitnob')
  ).length;
  const bitnobSuccess = recentTxns.filter((t) => t.settledAt).length;
  const bitnobRate = bitnobSuccess / (bitnobSuccess + bitnobFailures + 1);

  // M-Pesa health (indirect via Bitnob)
  const mpesaFailures = recentTxns.filter(
    (t) => t.status === 'FAILED' && t.failureReason?.includes('M-Pesa')
  ).length;
  const mpesaRate = bitnobSuccess / (bitnobSuccess + mpesaFailures + 1);

  return {
    worldChain: {
      status: blockchainRate > 0.9 ? 'HEALTHY' : blockchainRate > 0.7 ? 'DEGRADED' : 'UNKNOWN',
      notes: `${(blockchainRate * 100).toFixed(1)}% confirmation success rate`,
    },
    bitnob: {
      status: bitnobRate > 0.9 ? 'HEALTHY' : bitnobRate > 0.7 ? 'DEGRADED' : 'UNKNOWN',
      notes: `${(bitnobRate * 100).toFixed(1)}% payout success rate`,
    },
    mpesa: {
      status: mpesaRate > 0.9 ? 'HEALTHY' : mpesaRate > 0.7 ? 'DEGRADED' : 'UNKNOWN',
      notes: `${(mpesaRate * 100).toFixed(1)}% disbursement success rate`,
    },
  };
}

function generateRecommendations(
  failures: FailureAnalysis[],
  stuck: StuckAnalysis[],
  refunds: RefundAnalysis[],
  health: PipelineHealth
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Critical: Fake refunds
  const fakeRefunds = refunds.filter((r) => r.legitimacy === 'INVALID' && r.fixable);
  if (fakeRefunds.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'REFUND',
      title: 'Fix Fake Refund Records',
      description: `${fakeRefunds.length} transaction(s) marked as REFUNDED but no on-chain proof exists. Users may think they were refunded when they were not.`,
      action: 'Run --fix to reset these to REFUND_FAILED so users can retry',
      affectedTransactions: fakeRefunds.map((r) => r.transactionId),
    });
  }

  // Critical: Failed refunds with WLD at risk
  const failedRefunds = refunds.filter((r) => r.refundStatus === 'REFUND_FAILED' && r.fixable);
  if (failedRefunds.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'REFUND',
      title: 'Retry Failed On-Chain Refunds',
      description: `${failedRefunds.length} refund(s) failed on-chain. WLD is still held by backend and user has not been repaid.`,
      action: 'Ensure ADMIN_PRIVATE_KEY is configured with sufficient gas, then retry refunds',
      affectedTransactions: failedRefunds.map((r) => r.transactionId),
    });
  }

  // High: Stuck transactions
  const stuckAuto = stuck.filter((s) => s.autoRecoverable && s.durationMinutes > 30);
  if (stuckAuto.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'PIPELINE',
      title: 'Auto-Recover Stuck Transactions',
      description: `${stuckAuto.length} transaction(s) stuck for >30 minutes but can be auto-recovered via retry mechanism.`,
      action: 'Implement automated stuck-transaction retry worker or notify users to use Conflict Resolution',
      affectedTransactions: stuckAuto.map((s) => s.transactionId),
    });
  }

  // High: Bitnob timeouts
  const bitnobTimeouts = failures.filter((f) => f.rootCause === 'BITNOB_TIMEOUT');
  if (bitnobTimeouts.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'INTEGRATION',
      title: 'Bitnob Timeout Handling',
      description: 'Multiple Bitnob payout timeouts detected. Payouts may have succeeded but status was not properly polled.',
      action: 'Increase polling timeout from 3min to 5min and implement webhook reconciliation',
    });
  }

  // Medium: Pipeline monitoring
  if (health.worldChain.status === 'DEGRADED' || health.bitnob.status === 'DEGRADED') {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'MONITORING',
      title: 'Integration Health Degraded',
      description: `World Chain: ${health.worldChain.notes}, Bitnob: ${health.bitnob.notes}`,
      action: 'Set up automated alerts for integration failure rates >10%',
    });
  }

  // Medium: Missing webhook events
  const hasWebhookGaps = stuck.some((s) => s.status === 'MPESA_SENT' && !s.hasOfframpId);
  if (hasWebhookGaps) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'INTEGRATION',
      title: 'Webhook Event Gaps',
      description: 'Some transactions stuck at MPESA_SENT without Bitnob offramp ID - webhook may have been missed.',
      action: 'Implement webhook retry queue and manual reconciliation endpoint',
    });
  }

  return recommendations;
}

// ─── Fix Functions ────────────────────────────────────────────────────────────

async function fixFakeRefunds(refunds: RefundAnalysis[], txns: any[]): Promise<number> {
  const fake = refunds.filter((r) => r.legitimacy === 'INVALID' && r.fixable);
  let fixed = 0;

  for (const r of fake) {
    const tx = txns.find((t) => t.id === r.transactionId);
    const wldNeverSent = !tx?.txHash;

    if (wldNeverSent) {
      // No WLD was sent - clear refund status entirely
      await prisma.transaction.update({
        where: { id: r.transactionId },
        data: {
          refundStatus: null,
          refundTxHash: null,
        },
      });
      console.log(`  ${c.green}${icon.check}${c.reset} ${shortId(r.transactionId)} → cleared refund status (no WLD sent)`);
    } else {
      // WLD was sent but marked as refunded without txHash - reset to REFUND_FAILED
      await prisma.transaction.update({
        where: { id: r.transactionId },
        data: {
          refundStatus: 'REFUND_FAILED',
          refundTxHash: null,
        },
      });
      console.log(`  ${c.green}${icon.check}${c.reset} ${shortId(r.transactionId)} → reset to REFUND_FAILED`);
    }
    fixed++;
  }

  return fixed;
}

// ─── Reporting Functions ───────────────────────────────────────────────────────

async function printFailureReport(analyses: FailureAnalysis[]) {
  console.log(`\n${c.bold}${c.red}━━━ FAILURE ANALYSIS (${analyses.length} transactions) ━━━${c.reset}\n`);

  if (analyses.length === 0) {
    console.log(`  ${c.green}${icon.check} No failed transactions found.${c.reset}`);
    return;
  }

  // Group by root cause
  const byCause: Record<string, FailureAnalysis[]> = {};
  for (const a of analyses) {
    byCause[a.rootCause] = byCause[a.rootCause] || [];
    byCause[a.rootCause].push(a);
  }

  for (const [cause, items] of Object.entries(byCause)) {
    console.log(`${c.bold}${c.yellow}${icon.warn} ${cause.replace(/_/g, ' ')} (${items.length})${c.reset}`);
    for (const item of items) {
      const iconChar = item.recoverable ? icon.retry : icon.cross;
      const color = item.recoverable ? c.yellow : c.red;
      console.log(`  ${color}${iconChar}${c.reset} ${shortId(item.transactionId)} | ${item.wldAmount} WLD | ${c.dim}${item.suggestedAction}${c.reset}`);
    }
    console.log('');
  }
}

async function printStuckReport(analyses: StuckAnalysis[]) {
  console.log(`\n${c.bold}${c.yellow}━━━ STUCK TRANSACTIONS (${analyses.length}) ━━━${c.reset}\n`);

  if (analyses.length === 0) {
    console.log(`  ${c.green}${icon.check} No stuck transactions.${c.reset}`);
    return;
  }

  const critical = analyses.filter((a) => a.durationMinutes > 60);
  const warning = analyses.filter((a) => a.durationMinutes <= 60);

  if (critical.length > 0) {
    console.log(`${c.bgRed}${c.bold} ⚠ CRITICAL: ${critical.length} transaction(s) stuck >1 hour ${c.reset}\n`);
  }

  for (const item of analyses) {
    const color = item.durationMinutes > 60 ? c.red : c.yellow;
    const iconChar = item.autoRecoverable ? icon.retry : icon.warn;
    console.log(
      `  ${color}${iconChar}${c.reset} ${shortId(item.transactionId)} | ${item.status} | ${item.durationMinutes}min | ${c.dim}${item.likelyCause}${c.reset}`
    );
  }
}

async function printRefundReport(analyses: RefundAnalysis[]) {
  console.log(`\n${c.bold}${c.cyan}━━━ REFUND ANALYSIS ━━━${c.reset}\n`);

  const valid = analyses.filter((r) => r.legitimacy === 'VALID');
  const suspicious = analyses.filter((r) => r.legitimacy === 'SUSPICIOUS');
  const invalid = analyses.filter((r) => r.legitimacy === 'INVALID');

  console.log(`  ${c.green}${valid.length} Valid${c.reset} | ${c.yellow}${suspicious.length} Suspicious${c.reset} | ${c.red}${invalid.length} Invalid${c.reset}\n`);

  if (invalid.length > 0) {
    console.log(`${c.red}${icon.cross} Invalid refunds (requires action):${c.reset}`);
    for (const r of invalid) {
      console.log(`    ${shortId(r.transactionId)} | ${c.dim}${r.issue}${c.reset}`);
    }
    console.log('');
  }

  if (suspicious.length > 0) {
    console.log(`${c.yellow}${icon.warn} Suspicious refunds (review recommended):${c.reset}`);
    for (const r of suspicious) {
      console.log(`    ${shortId(r.transactionId)} | ${c.dim}${r.issue}${c.reset}`);
    }
  }
}

async function printHealthReport(health: PipelineHealth) {
  console.log(`\n${c.bold}${c.blue}━━━ PIPELINE HEALTH ━━━${c.reset}\n`);

  const statusColor = (s: string) => (s === 'HEALTHY' ? c.green : s === 'DEGRADED' ? c.yellow : c.red);

  console.log(`  ${icon.chain} World Chain: ${statusColor(health.worldChain.status)}${health.worldChain.status}${c.reset}`);
  console.log(`    ${c.dim}${health.worldChain.notes}${c.reset}\n`);

  console.log(`  ${icon.money} Bitnob: ${statusColor(health.bitnob.status)}${health.bitnob.status}${c.reset}`);
  console.log(`    ${c.dim}${health.bitnob.notes}${c.reset}\n`);

  console.log(`  ${icon.rocket} M-Pesa: ${statusColor(health.mpesa.status)}${health.mpesa.status}${c.reset}`);
  console.log(`    ${c.dim}${health.mpesa.notes}${c.reset}\n`);
}

async function printRecommendations(recs: Recommendation[]) {
  console.log(`\n${c.bold}${c.magenta}━━━ RECOMMENDATIONS (${recs.length}) ━━━${c.reset}\n`);

  const byPriority: Record<string, Recommendation[]> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const r of recs) {
    byPriority[r.priority].push(r);
  }

  for (const [priority, items] of Object.entries(byPriority)) {
    if (items.length === 0) continue;
    const color = priority === 'CRITICAL' ? c.bgRed : priority === 'HIGH' ? c.bgYellow : c.dim;
    console.log(`${color}${c.bold} ${priority} (${items.length}) ${c.reset}\n`);

    for (const r of items) {
      console.log(`${c.bold}${r.title}${c.reset} [${r.category}]`);
      console.log(`  ${c.dim}${r.description}${c.reset}`);
      console.log(`  ${c.cyan}${icon.info} Action:${c.reset} ${r.action}`);
      if (r.affectedTransactions) {
        console.log(`  ${c.dim}Affected: ${r.affectedTransactions.length} transaction(s)${c.reset}`);
      }
      console.log('');
    }
  }
}

async function generateJsonReport(report: AnalysisReport) {
  const fs = await import('fs');
  const filename = `transaction-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n${c.green}${icon.check} Report saved to: ${filename}${c.reset}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const shouldReport = args.includes('--report');
  const stuckOnly = args.includes('--stuck');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
${c.bold}Transaction Analyzer${c.reset}

Usage:
  npx tsx src/scripts/transaction-analyzer.ts [options]

Options:
  --fix      Auto-fix recoverable issues (fake refunds)
  --report   Generate JSON report file
  --stuck    Focus only on stuck transactions
  --help     Show this help

Examples:
  npx tsx src/scripts/transaction-analyzer.ts              # Full analysis
  npx tsx src/scripts/transaction-analyzer.ts --fix      # Fix issues
  npx tsx src/scripts/transaction-analyzer.ts --report   # JSON output
`);
    return;
  }

  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  WLD2Mpesa — Transaction Analyzer & Pipeline Diagnostics ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`  ${c.dim}${new Date().toISOString()}${c.reset}\n`);

  // Load transactions
  const txns = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { webhookEvents: true },
  });

  console.log(`  ${icon.info} Loaded ${c.bold}${txns.length}${c.reset} transaction(s) from database.\n`);

  // Run analyses
  const failures = await analyzeFailures(txns);
  const stuck = await analyzeStuckTransactions(txns);
  const refunds = await analyzeRefunds(txns);
  const health = await assessPipelineHealth(txns);
  const recommendations = generateRecommendations(failures, stuck, refunds, health);

  // Print reports
  if (stuckOnly) {
    await printStuckReport(stuck);
  } else {
    await printFailureReport(failures);
    await printStuckReport(stuck);
    await printRefundReport(refunds);
    await printHealthReport(health);
    await printRecommendations(recommendations);
  }

  // Fix if requested
  if (shouldFix) {
    console.log(`\n${c.bold}${c.yellow}━━━ AUTO-FIX MODE ━━━${c.reset}\n`);
    const fixed = await fixFakeRefunds(refunds, txns);
    console.log(`\n${c.green}Fixed ${fixed} fake refund record(s).${c.reset}`);
  }

  // Generate report if requested
  if (shouldReport) {
    const report: AnalysisReport = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions: txns.length,
        byStatus: txns.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalWldVolume: txns.reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0).toFixed(4),
        atRiskWld: refunds
          .filter((r) => r.refundStatus === 'REFUND_FAILED')
          .reduce((s, r) => s + parseFloat(r.wldAmount), 0)
          .toFixed(4),
      },
      failures,
      stuck,
      refunds,
      pipelineHealth: health,
      recommendations,
    };
    await generateJsonReport(report);
  }

  await prisma.$disconnect();

  // Exit code based on critical issues
  const hasCritical = recommendations.some((r) => r.priority === 'CRITICAL');
  if (hasCritical && !shouldFix) {
    console.log(`${c.red}${icon.cross} Critical issues found. Run with --fix to auto-resolve.${c.reset}\n`);
    process.exit(1);
  }

  console.log(`${c.green}${icon.check} Analysis complete.${c.reset}\n`);
}

main().catch((e) => {
  console.error(c.red + '\n[ANALYZER ERROR]' + c.reset, e);
  process.exit(1);
});
