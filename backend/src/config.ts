/**
 * config.ts — Application configuration
 *
 * This project is designed to run against live Worldcoin and payment APIs.
 * Run locally with real app settings (World App App ID + Action ID) and
 * real backend credentials.
 */

import 'dotenv/config';

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function optionalEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseFloat(val) : fallback;
}

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = optionalEnvNumber('PORT', 3001);
const NODE_ENV = optionalEnv('NODE_ENV', 'development');
const IS_PRODUCTION = NODE_ENV === 'production';

// ─── World Chain RPC ───────────────────────────────────────────────────────────
const WORLD_CHAIN_RPC_URL = optionalEnv(
  'WORLD_CHAIN_RPC_URL',
  'https://worldchain-mainnet.g.alchemy.com/public'
);

// ─── World Chain wallet ───────────────────────────────────────────────────────
// TODO: PRODUCTION - Replace with real World Chain wallet address
const BACKEND_WALLET_ADDRESS = optionalEnv(
  'BACKEND_WALLET_ADDRESS',
  '0xSIMULATED_BACKEND_WALLET_ADDRESS'
);

// ─── World App ────────────────────────────────────────────────────────────────
// TODO: PRODUCTION - Set real values from World Developer Portal
const WLD_APP_ID = optionalEnv('WLD_APP_ID', 'app_ac9f43a974959b04b11b081c3740f932');
const WLD_RP_ID = optionalEnv('WLD_RP_ID', 'rp_c205808e8673f770'); // Defaults to App ID in 4.0 if not specified
const WLD_SIGNING_KEY = optionalEnv('WLD_SIGNING_KEY', ''); // REQUIRED for World ID 4.0
const WLD_LOGIN_ACTION_ID = optionalEnv('WLD_LOGIN_ACTION_ID', 'wld2mpesa-login');
const WLD_PAY_ACTION_ID = optionalEnv('WLD_PAY_ACTION_ID', 'wld2mpesa-pay');

// ─── Off-ramp: Bitnob ─────────────────────────────────────────────────────────
// TODO: PRODUCTION - Sign up at https://bitnob.com
const BITNOB_API_KEY = optionalEnv('BITNOB_API_KEY', '');
const BITNOB_ENV = optionalEnv('BITNOB_ENV', 'sandbox'); // 'sandbox' | 'production'

// ─── DEX Swap (Uniswap V3 on World Chain) ────────────────────────────────────
const UNISWAP_V3_ROUTER = '0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743';
const WLD_TOKEN = '0x2cFc85d8E48F8EAB294be644d9E256F01c2384a0';
const USDC_TOKEN = '0x79A02482A8849733928120FE3c23eA97B068D2e3'; // Native USDC on World Chain
const ADMIN_PRIVATE_KEY = optionalEnv('ADMIN_PRIVATE_KEY', '');

// ─── M-Pesa Daraja ────────────────────────────────────────────────────────────
// TODO: PRODUCTION - Register at https://developer.safaricom.co.ke
const MPESA_CONSUMER_KEY = optionalEnv('MPESA_CONSUMER_KEY', '');
const MPESA_CONSUMER_SECRET = optionalEnv('MPESA_CONSUMER_SECRET', '');
const MPESA_ENV = optionalEnv('MPESA_ENV', 'sandbox'); // 'sandbox' | 'production'
const MPESA_SHORTCODE = optionalEnv('MPESA_SHORTCODE', '174379'); // Daraja sandbox default
const MPESA_B2B_SHORTCODE = optionalEnv('MPESA_B2B_SHORTCODE', '600000');
const MPESA_INITIATOR_NAME = optionalEnv('MPESA_INITIATOR_NAME', 'testapi');
const MPESA_PASSKEY = optionalEnv('MPESA_PASSKEY', '');

// ─── Backend URL (needed for M-Pesa callbacks) ────────────────────────────────
// TODO: PRODUCTION - Set to your deployed Render/Railway URL
const BACKEND_URL = optionalEnv('BACKEND_URL', 'http://localhost:3001');

// ─── Transaction log ──────────────────────────────────────────────────────────
const TRANSACTION_LOG_PATH = optionalEnv('TRANSACTION_LOG_PATH', './data/transactions.json');

// ─── Fee config ───────────────────────────────────────────────────────────────
const FEE_PERCENT = optionalEnvNumber('FEE_PERCENT', 0.5);
const MIN_KES_AMOUNT = optionalEnvNumber('MIN_KES_AMOUNT', 10);
const MAX_KES_AMOUNT = optionalEnvNumber('MAX_KES_AMOUNT', 150000);

// ─── Simulation delays (realistic mock timings) ───────────────────────────────
const SIM_BLOCK_CONFIRM_MS = 5000;   // 5s for "block confirmation" (real: ~30s)
const SIM_OFFRAMP_MS = 8000;         // 8s for "off-ramp" (real: ~2min)
const SIM_MPESA_MS = 5000;           // 5s for "M-Pesa disbursement" (real: ~30s)

// ─── Export ───────────────────────────────────────────────────────────────────

export const config = {
  PORT,
  NODE_ENV,
  IS_PRODUCTION,
  WORLD_CHAIN_RPC_URL,

  BACKEND_WALLET_ADDRESS,
  WLD_APP_ID,
  WLD_RP_ID,
  WLD_SIGNING_KEY,
  WLD_LOGIN_ACTION_ID,
  WLD_PAY_ACTION_ID,

  BITNOB_API_KEY,
  BITNOB_ENV,
  UNISWAP_V3_ROUTER,
  WLD_TOKEN,
  USDC_TOKEN,
  ADMIN_PRIVATE_KEY,

  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_ENV,
  MPESA_SHORTCODE,
  MPESA_B2B_SHORTCODE,
  MPESA_INITIATOR_NAME,
  MPESA_PASSKEY,

  BACKEND_URL,
  TRANSACTION_LOG_PATH,

  FEE_PERCENT,
  MIN_KES_AMOUNT,
  MAX_KES_AMOUNT,

  SIM_BLOCK_CONFIRM_MS,
  SIM_OFFRAMP_MS,
  SIM_MPESA_MS,
} as const;

// Log config state on startup
console.log(`
╔═══════════════════════════════════════════════════════╗
║  WLD2Mpesa Backend                                  ║
║  Mode: ${IS_PRODUCTION ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT'}  ║
║  Port: ${PORT}                                         ║
║  World App App ID: ${WLD_APP_ID}                       ║
║  World ID 4.0 RP ID: ${WLD_RP_ID}                       ║
║  World ID Login Action: ${WLD_LOGIN_ACTION_ID}         ║
║  World ID Pay Action: ${WLD_PAY_ACTION_ID}             ║
╚═══════════════════════════════════════════════════════╝
`);

// Warn about missing environment variables (will cause runtime failures)
const requiredEnvVars = [
  'BACKEND_WALLET_ADDRESS',
  'KOTANI_API_KEY',
  'KOTANI_SECRET',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(`\n⚠️  Missing env vars: ${missing.join(', ')}`);
  console.warn('   Affected services will fail at runtime. Set these in backend/.env to enable them.\n');
} else {
  console.log('✅ All required environment variables present');
}
