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
import { prisma } from '../db/prisma';

// ─── ANSI colour helpers ──────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  bgRed:  '\x1b[41m',
  bgYellow: '\x1b[43m',
};

function tag(color: string, label: string): string {
  return `${color}${c.bold}[${label}]${c.reset}`;
}

function fmt(date: Date | null | undefined): string {
  if (!date) return c.dim + 'N/A' + c.reset;
  return new Date(date).toLocaleString('en-KE', { hour12: false });
}

function shortId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 16)}…` : id;
}

function refundTag(status: string | null): string {
  if (!status) return c.dim + 'none' + c.reset;
  if (status === 'REFUNDED')         return c.green  + c.bold + 'REFUNDED' + c.reset;
  if (status === 'REFUND_INITIATED') return c.yellow + c.bold + 'INITIATED' + c.reset;
  if (status === 'REFUND_FAILED')    return c.red    + c.bold + 'FAILED' + c.reset;
  return status;
}

function txStatusTag(status: string): string {
  if (status === 'SETTLED')  return c.green  + status + c.reset;
  if (status === 'FAILED')   return c.red    + status + c.reset;
  if (status === 'INITIATED') return c.dim   + status + c.reset;
  return c.yellow + status + c.reset;
}

// ─── Report sections ──────────────────────────────────────────────────────────

async function reportRefunds(txns: any[]) {
  const refunds = txns.filter(t => t.refundStatus != null);

  console.log(`\n${c.bold}${c.cyan}━━━ REFUND AUDIT (${refunds.length} records) ━━━${c.reset}\n`);

  if (refunds.length === 0) {
    console.log(c.dim + '  No refund records found.' + c.reset);
    return;
  }

  // ── Integrity check: REFUNDED but no txHash ──────────────────────────────
  const fakeRefunded = refunds.filter(t => t.refundStatus === 'REFUNDED' && !t.refundTxHash);
  if (fakeRefunded.length > 0) {
    console.log(`${c.bgRed}${c.bold} ⚠  WARNING: ${fakeRefunded.length} transaction(s) marked REFUNDED with no on-chain hash ${c.reset}`);
    console.log(`${c.red}   These were set by the old simulation stub — WLD was NOT actually returned.${c.reset}`);
    console.log(`${c.yellow}   Run with --fix-fake to reset them to REFUND_FAILED so the user can retry.${c.reset}\n`);
    for (const t of fakeRefunded) {
      console.log(`   ${c.bold}${t.id}${c.reset}  ${t.wldAmount} WLD  wallet: ${t.walletAddress.slice(0, 10)}…  failed_at: ${fmt(t.failedAt)}`);
    }
    console.log('');
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  const header = `${'Transaction ID'.padEnd(28)} ${'WLD'.padStart(10)} ${'Status'.padEnd(12)} ${'Refund'.padEnd(12)} ${'TxHash'.padEnd(16)} ${'Refund At'}`;
  console.log(c.bold + header + c.reset);
  console.log('─'.repeat(header.length));

  for (const t of refunds) {
    const hasHash = t.refundTxHash && t.refundTxHash !== 'N/A';
    const hashDisplay = hasHash
      ? c.green + t.refundTxHash.slice(0, 10) + '…' + c.reset
      : c.red + 'NO HASH' + c.reset;
    console.log(
      `${shortId(t.id).padEnd(28)} ${(parseFloat(t.wldAmount) || 0).toFixed(6).padStart(10)} ` +
      `${txStatusTag(t.status).padEnd(20)} ${refundTag(t.refundStatus).padEnd(20)} ` +
      `${hashDisplay.padEnd(24)} ${fmt(t.refundAt)}`
    );
  }
}

async function reportStuck(txns: any[]) {
  const STUCK_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
  const stuck = txns.filter(t => STUCK_STATUSES.includes(t.status));
  const cutoffMs = 30 * 60 * 1000; // 30 min
  const old = stuck.filter(t => Date.now() - new Date(t.createdAt).getTime() > cutoffMs);

  console.log(`\n${c.bold}${c.yellow}━━━ STUCK PIPELINE (${stuck.length} active, ${old.length} stale >30min) ━━━${c.reset}\n`);

  if (stuck.length === 0) {
    console.log(c.dim + '  No stuck transactions.' + c.reset);
    return;
  }

  for (const t of stuck) {
    const ageMin = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 60000);
    const staleTag = ageMin > 30 ? c.red + ` ⚠ ${ageMin}min old` + c.reset : c.dim + ` ${ageMin}min` + c.reset;
    console.log(`  ${c.bold}${t.id}${c.reset}  ${txStatusTag(t.status).padEnd(20)} ${parseFloat(t.wldAmount).toFixed(6)} WLD  ${staleTag}`);
    if (t.txHash) console.log(`    chain tx: ${t.txHash.slice(0, 14)}…`);
    if (t.offrampId) console.log(`    bitnob:   ${t.offrampId.slice(0, 14)}…`);
  }
}

async function reportFailed(txns: any[]) {
  const failed = txns.filter(t => t.status === 'FAILED');

  console.log(`\n${c.bold}${c.red}━━━ FAILED TRANSACTIONS (${failed.length}) ━━━${c.reset}\n`);

  if (failed.length === 0) {
    console.log(c.dim + '  No failed transactions.' + c.reset);
    return;
  }

  for (const t of failed) {
    const noRefund = !t.refundStatus;
    const wldSent = !!t.txHash;
    const alertIcon = (wldSent && noRefund) ? c.bgRed + ' ⚠ WLD AT RISK ' + c.reset + ' ' : '';
    console.log(`  ${alertIcon}${c.bold}${t.id}${c.reset}  ${parseFloat(t.wldAmount).toFixed(6)} WLD`);
    console.log(`    reason:  ${c.dim}${t.failureReason || 'N/A'}${c.reset}`);
    console.log(`    refund:  ${refundTag(t.refundStatus)}  hash: ${t.refundTxHash || c.dim + 'N/A' + c.reset}`);
    console.log(`    txHash:  ${t.txHash ? t.txHash.slice(0, 14) + '…' : c.dim + 'none (WLD not sent)' + c.reset}`);
    console.log(`    failed:  ${fmt(t.failedAt)}`);
    console.log('');
  }
}

async function reportSummary(txns: any[]) {
  const byStatus: Record<string, number> = {};
  for (const t of txns) byStatus[t.status] = (byStatus[t.status] || 0) + 1;

  const totalWld = txns.reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0);
  const settledWld = txns.filter(t => t.status === 'SETTLED').reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0);
  const refundedWld = txns.filter(t => t.refundStatus === 'REFUNDED' && t.refundTxHash).reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0);
  const fakeRefundedWld = txns.filter(t => t.refundStatus === 'REFUNDED' && !t.refundTxHash).reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0);
  const atRiskWld = txns.filter(t => t.status === 'FAILED' && t.txHash && !t.refundStatus).reduce((s, t) => s + parseFloat(t.wldAmount || '0'), 0);

  console.log(`\n${c.bold}${c.blue}━━━ SUMMARY (${txns.length} total transactions) ━━━${c.reset}\n`);
  console.log(`  Total WLD volume:    ${c.bold}${totalWld.toFixed(6)} WLD${c.reset}`);
  console.log(`  Settled:             ${c.green}${settledWld.toFixed(6)} WLD${c.reset}`);
  console.log(`  Refunded (on-chain): ${c.green}${refundedWld.toFixed(6)} WLD${c.reset}`);
  if (fakeRefundedWld > 0) {
    console.log(`  ${c.bgRed}Fake-refunded (stub): ${fakeRefundedWld.toFixed(6)} WLD — NOT returned on-chain${c.reset}`);
  }
  if (atRiskWld > 0) {
    console.log(`  ${c.bgYellow}At risk (failed+no refund): ${atRiskWld.toFixed(6)} WLD${c.reset}`);
  }
  console.log('');
  console.log(`  By status:`);
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`    ${txStatusTag(status).padEnd(30)} ${count}`);
  }
}

// ─── Fix stale fake-REFUNDED records ─────────────────────────────────────────

async function fixFakeRefunded(txns: any[]) {
  const fake = txns.filter(t => t.refundStatus === 'REFUNDED' && !t.refundTxHash);

  if (fake.length === 0) {
    console.log('\n' + c.green + '✓ No fake-REFUNDED records found.' + c.reset);
    return;
  }

  console.log(`\n${c.yellow}Resetting ${fake.length} fake-REFUNDED record(s) → REFUND_FAILED so users can retry:${c.reset}\n`);

  for (const t of fake) {
    await prisma.transaction.update({
      where: { id: t.id },
      data: {
        refundStatus: 'REFUND_FAILED',
        refundTxHash: null,
      },
    });
    console.log(`  ${c.green}✓${c.reset} ${t.id}  ${t.wldAmount} WLD  → ${c.red}REFUND_FAILED${c.reset}`);
  }

  console.log(`\n${c.green}Done. Users will now see "Refund Failed" with an option to retry via Conflict Resolution.${c.reset}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const showRefunds = args.includes('--refunds');
  const showStuck   = args.includes('--stuck');
  const showFailed  = args.includes('--failed');
  const fixFake     = args.includes('--fix-fake');
  const showAll     = !showRefunds && !showStuck && !showFailed && !fixFake;

  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════╗`);
  console.log(`║  WLD2Mpesa — Database Audit              ║`);
  console.log(`╚══════════════════════════════════════════╝${c.reset}`);
  console.log(`  ${c.dim}${new Date().toISOString()}${c.reset}\n`);

  const txns = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
  });

  console.log(`  Loaded ${c.bold}${txns.length}${c.reset} transaction(s) from database.`);

  if (fixFake) {
    await fixFakeRefunded(txns);
    await prisma.$disconnect();
    return;
  }

  if (showAll || showRefunds) await reportRefunds(txns);
  if (showAll || showStuck)   await reportStuck(txns);
  if (showAll || showFailed)  await reportFailed(txns);
  if (showAll)                await reportSummary(txns);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(c.red + '\n[AUDIT ERROR]' + c.reset, e);
  process.exit(1);
});
