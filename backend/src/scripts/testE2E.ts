#!/usr/bin/env tsx
/**
 * testE2E.ts — End-to-end payment simulation script
 *
 * Simulates a complete payment flow via HTTP, exactly as the frontend does:
 *   1. Fetch rate
 *   2. Initiate payment (KES 500 → Till 123456)
 *   3. Confirm payment (simulate MiniKit pay())
 *   4. Poll status until SETTLED or FAILED
 *   5. Print full transaction log
 *
 * Usage:
 *   cd backend && npm run test:e2e
 *   # or directly:
 *   npx tsx src/scripts/testE2E.ts
 *
 * Ensure the backend is running first: npm run dev
 */

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3001/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} failed: ${JSON.stringify(data)}`);
  return data as T;
}

function log(emoji: string, msg: string): void {
  console.log(`${emoji} [${new Date().toLocaleTimeString('en-KE')}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateData { wldPriceKes: number; source: string }
interface InitResult { transactionId: string; wldAmount: string; feeKes: number }
interface ConfirmResult { transactionId: string; status: string; estimatedSettlementMinutes: number }
interface StatusResult {
  transactionId: string;
  status: string;
  mpesaReceiptNumber?: string;
  failureReason?: string;
  steps: Array<{ step: string; done: boolean }>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  WLD2Mpesa — End-to-End Payment Test          ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // ── Step 0: Health check ──────────────────────────────────────────────────
  const health = await apiGet<{ status: string; simulationMode: boolean }>('/health');
  log('🏥', `Backend healthy | Simulation mode: ${health.simulationMode}`);

  if (!health.simulationMode) {
    console.error('\n⛔ SIMULATION_MODE is false — this test runs real money! Aborting.');
    process.exit(1);
  }

  // ── Step 1: Fetch rate ────────────────────────────────────────────────────
  log('📈', 'Fetching WLD/KES rate…');
  const rate = await apiGet<RateData>('/rates/wld-kes');
  log('✅', `Rate: 1 WLD = KES ${rate.wldPriceKes} (source: ${rate.source})`);

  // ── Step 2: Initiate payment ──────────────────────────────────────────────
  const TEST_KES = 500;
  const TEST_TILL = '123456';

  log('💳', `Initiating payment: KES ${TEST_KES} → Till ${TEST_TILL}`);
  const init = await apiPost<InitResult>('/payment/initiate', {
    kesAmount: TEST_KES,
    tillNumber: TEST_TILL,
    walletAddress: '0xTEST_WALLET_E2E',
  });

  log('✅', `Transaction ID: ${init.transactionId}`);
  log('💰', `WLD required: ${init.wldAmount} WLD (fee: KES ${init.feeKes})`);

  // ── Step 3: Simulate MiniKit pay() ───────────────────────────────────────
  log('🌍', 'Simulating MiniKit pay() (1.5s delay)…');
  await sleep(1500);
  const fakeTxHash = `0xSIMULATED_E2E_${Date.now()}`;

  const confirm = await apiPost<ConfirmResult>('/payment/confirm', {
    transactionId: init.transactionId,
    txHash: fakeTxHash,
    miniKitPayload: { simulated: true, reference: init.transactionId },
  });

  log('✅', `Confirmed: status=${confirm.status} | ETA: ${confirm.estimatedSettlementMinutes}min`);

  // ── Step 4: Poll status ───────────────────────────────────────────────────
  log('⏳', 'Polling transaction status…\n');
  const POLL_INTERVAL = 1000;
  const MAX_POLLS = 60; // 60 seconds max
  let polls = 0;

  while (polls < MAX_POLLS) {
    const status = await apiGet<StatusResult>(`/payment/status/${init.transactionId}`);
    const doneSteps = status.steps.filter((s) => s.done).map((s) => s.step);

    process.stdout.write(
      `\r   Status: ${status.status.padEnd(25)} Steps done: [${doneSteps.join(', ')}]`
    );

    if (status.status === 'SETTLED') {
      console.log('\n');
      log('🎉', `SETTLED! M-Pesa receipt: ${status.mpesaReceiptNumber}`);
      console.log('\n╔═══════════════════════════════════════════════╗');
      console.log('║  ✅ End-to-end test PASSED                    ║');
      console.log('╚═══════════════════════════════════════════════╝\n');
      process.exit(0);
    }

    if (status.status === 'FAILED') {
      console.log('\n');
      log('❌', `FAILED: ${status.failureReason}`);
      process.exit(1);
    }

    await sleep(POLL_INTERVAL);
    polls++;
  }

  console.log('\n');
  log('⏱️', 'Timeout — transaction did not settle in 60 seconds');
  process.exit(1);
}

main().catch((err: Error) => {
  console.error('\n❌ Test error:', err.message);
  process.exit(1);
});
