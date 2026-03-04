# TRANSITION GUIDE — Simulation → Production

> **Audience:** The solo developer taking WLD2Mpesa from MVP to live money.
> **Time estimate:** 1–2 weeks with all third-party accounts ready.
> **Risk level:** Low — each step is independently testable.

---

## Overview

This guide provides exact, diff-style instructions for every change needed to go from `SIMULATION_MODE=true` to a fully live payment system. Each section tells you:
- **Which file to change**
- **What to remove (-)** and **what to add (+)**
- **How to verify** the change works

---

## Step 1 — Flip the Master Switch

**File:** `backend/src/config.ts`

```diff
- SIMULATION_MODE: process.env.SIMULATION_MODE !== 'false', // defaults to TRUE
+ SIMULATION_MODE: process.env.SIMULATION_MODE === 'true', // defaults to FALSE
```

**Then in `.env` (production):**
```diff
- SIMULATION_MODE=true
+ SIMULATION_MODE=false
```

**Verify:** `GET /api/health` should return `"simulationMode": false`

---

## Step 2 — Real WLD Rate from CoinGecko

**File:** `backend/src/services/rateService.ts`

```diff
- // SIMULATION: returns hardcoded rate
- async getWldKesRate(): Promise<RateData> {
-   return {
-     wldPriceKes: 2364.50,
-     wldPriceUsd: 16.25,
-     usdKesRate: 145.50,
-     source: 'simulated',
-     cachedAt: new Date().toISOString(),
-   };
- }

+ // PRODUCTION: fetch from CoinGecko
+ async getWldKesRate(): Promise<RateData> {
+   const response = await fetch(
+     'https://api.coingecko.com/api/v3/simple/price?ids=worldcoin-wld&vs_currencies=kes,usd',
+     { headers: { 'x-cg-api-key': config.COINGECKO_API_KEY } }
+   );
+   const data = await response.json();
+   return {
+     wldPriceKes: data['worldcoin-wld'].kes,
+     wldPriceUsd: data['worldcoin-wld'].usd,
+     usdKesRate: data['worldcoin-wld'].kes / data['worldcoin-wld'].usd,
+     source: 'coingecko',
+     cachedAt: new Date().toISOString(),
+   };
+ }
```

**Verify:**
```bash
curl https://api.coingecko.com/api/v3/simple/price?ids=worldcoin-wld&vs_currencies=kes,usd
# Should return live WLD price
```

---

## Step 3 — Real World Chain Listener

**File:** `backend/src/services/worldChainListener.ts`

**Install dependency first:**
```bash
cd backend && npm install viem
```

```diff
- // SIMULATION: setTimeout mock
- async waitForWldTransfer(toAddress: string, expectedAmount: bigint, txHash: string): Promise<boolean> {
-   await sleep(SIMULATED_BLOCK_CONFIRM_MS);
-   this.log(`[SIMULATED] WLD transfer confirmed for ${txHash}`);
-   return true;
- }

+ // PRODUCTION: viem public client watching World Chain
+ import { createPublicClient, http, parseAbiItem } from 'viem';
+ import { worldchain } from 'viem/chains'; // or define custom chain
+
+ const WLD_CONTRACT = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003'; // World Chain WLD token
+
+ async waitForWldTransfer(toAddress: string, expectedAmount: bigint, txHash: string): Promise<boolean> {
+   const client = createPublicClient({
+     chain: worldchain,
+     transport: http(config.WORLD_CHAIN_RPC_URL),
+   });
+
+   // Wait for transaction receipt
+   const receipt = await client.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
+
+   if (receipt.status !== 'success') return false;
+
+   // Parse Transfer event from WLD ERC-20
+   const transferEvent = receipt.logs.find(log =>
+     log.address.toLowerCase() === WLD_CONTRACT.toLowerCase()
+   );
+
+   return transferEvent !== undefined;
+ }
```

**Required env vars:**
```bash
WORLD_CHAIN_RPC_URL=https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Step 4 — Real Off-Ramp (Yellow Card)

**File:** `backend/src/services/offrampService.ts`

**Replace `SimulatedOfframpService` usage in `paymentService.ts`:**

```diff
- const offrampService = new SimulatedOfframpService();
+ const offrampService = new YellowCardOfframpService();
```

**Implement `YellowCardOfframpService`** (already stubbed in the file):

```diff
- // TODO: PRODUCTION - Replace with real Yellow Card API call
- async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
-   throw new Error('Not implemented — see TRANSITION_GUIDE.md Step 4');
- }

+ async initiateSwap(wldAmount: string, kesAmount: number, txnId: string): Promise<SwapResult> {
+   const timestamp = Date.now();
+   const body = JSON.stringify({
+     country: 'KE',
+     networkId: 'world-chain',
+     source: { currency: 'WLD', amount: wldAmount },
+     destination: { currency: 'KES', accountType: 'business_wallet' },
+     sequenceId: txnId,
+   });
+
+   const signature = createHmac('sha256', config.YELLOW_CARD_SECRET)
+     .update(`${timestamp}${body}`)
+     .digest('hex');
+
+   const response = await fetch(`${YELLOW_CARD_BASE_URL}/business/payments`, {
+     method: 'POST',
+     headers: {
+       'Content-Type': 'application/json',
+       'Authorization': `YC-HMAC-SHA256 Credential=${config.YELLOW_CARD_API_KEY}, Timestamp=${timestamp}, Signature=${signature}`,
+     },
+     body,
+   });
+
+   const data = await response.json();
+   return { swapId: data.id, status: 'PENDING', estimatedKes: data.destination.amount };
+ }
```

---

## Step 5 — Real M-Pesa B2B Disbursement

**File:** `backend/src/services/mpesaService.ts`

**Replace `SimulatedMpesaService`:**

```diff
- const mpesaService = new SimulatedMpesaService();
+ const mpesaService = new DarajaMpesaService();
```

**Implement `DarajaMpesaService`:**

```diff
- // TODO: PRODUCTION - Replace with real Daraja B2B API call
- async sendToTill(tillNumber: string, kesAmount: number, txnId: string): Promise<MpesaResult> {
-   throw new Error('Not implemented — see TRANSITION_GUIDE.md Step 5');
- }

+ async sendToTill(tillNumber: string, kesAmount: number, txnId: string): Promise<MpesaResult> {
+   const token = await this.getAccessToken();
+   const credential = await this.getSecurityCredential();
+
+   const response = await fetch(`${DARAJA_BASE_URL}/mpesa/b2b/v1/paymentrequest`, {
+     method: 'POST',
+     headers: {
+       'Authorization': `Bearer ${token}`,
+       'Content-Type': 'application/json',
+     },
+     body: JSON.stringify({
+       Initiator: config.MPESA_INITIATOR_NAME,
+       SecurityCredential: credential,
+       CommandID: 'BusinessBuyGoods',
+       Amount: Math.floor(kesAmount).toString(),
+       PartyA: config.MPESA_B2B_SHORTCODE,
+       PartyB: tillNumber,
+       Remarks: `WLD2Mpesa-${txnId}`,
+       QueueTimeOutURL: `${config.BACKEND_URL}/api/mpesa/timeout`,
+       ResultURL: `${config.BACKEND_URL}/api/mpesa/result`,
+       AccountReference: txnId,
+       Requester: '',
+     }),
+   });
+
+   const data = await response.json();
+   if (data.ResponseCode !== '0') throw new Error(data.ResponseDescription);
+   return { requestId: data.ConversationID, status: 'PENDING' };
+ }
+
+ private async getAccessToken(): Promise<string> {
+   const credentials = Buffer.from(
+     `${config.MPESA_CONSUMER_KEY}:${config.MPESA_CONSUMER_SECRET}`
+   ).toString('base64');
+
+   const response = await fetch(
+     `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
+     { headers: { 'Authorization': `Basic ${credentials}` } }
+   );
+   const data = await response.json();
+   return data.access_token;
+ }
```

---

## Step 6 — Verify MiniKit Payload Signature

**File:** `backend/src/routes/payment.routes.ts`

```diff
- // SIMULATION: skip payload verification
- // TODO: PRODUCTION - verify MiniKit payload

+ // PRODUCTION: verify MiniKit pay() response
+ import { MiniKit } from '@worldcoin/minikit-js/api';
+
+ const isValid = await MiniKit.validatePayment({
+   payload: req.body.miniKitPayload,
+   action: 'pay',
+   appId: config.WLD_APP_ID,
+ });
+
+ if (!isValid) {
+   return res.status(400).json({ error: 'Invalid MiniKit payload' });
+ }
```

---

## Step 7 — World ID Verification (Optional but Recommended)

**File:** `backend/src/routes/payment.routes.ts`

```diff
- // SIMULATION: skip World ID proof verification
- if (worldIdProof) {
-   console.log('[SIMULATED] World ID proof accepted');
- }

+ // PRODUCTION: verify World ID proof on-chain
+ if (worldIdProof) {
+   const verifyResponse = await fetch('https://developer.worldcoin.org/api/v2/verify/' + config.WLD_APP_ID, {
+     method: 'POST',
+     headers: { 'Content-Type': 'application/json' },
+     body: JSON.stringify({
+       nullifier_hash: worldIdProof.nullifier_hash,
+       merkle_root: worldIdProof.merkle_root,
+       proof: worldIdProof.proof,
+       verification_level: worldIdProof.verification_level,
+       action: config.WLD_ACTION_ID,
+     }),
+   });
+   const { verified } = await verifyResponse.json();
+   if (!verified) return res.status(400).json({ error: 'World ID verification failed' });
+ }
```

---

## Step 8 — Webhook Handler for Async Callbacks

M-Pesa and Yellow Card send async callbacks (not instant responses). You need webhook endpoints.

**File:** `backend/src/routes/webhooks.routes.ts` *(create this file)*

```typescript
// POST /api/mpesa/result — M-Pesa B2B result callback
router.post('/mpesa/result', async (req, res) => {
  const { Result } = req.body;
  const txnId = Result.ReferenceData?.ReferenceItem?.find(
    (i: any) => i.Key === 'AccountReference'
  )?.Value;

  if (Result.ResultCode === 0) {
    await paymentService.markSettled(txnId, Result.TransactionID);
  } else {
    await paymentService.markFailed(txnId, Result.ResultDesc);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// POST /api/yellowcard/webhook — Yellow Card payment status webhook
router.post('/yellowcard/webhook', async (req, res) => {
  // Verify HMAC signature
  // Update transaction status
});
```

---

## Step 9 — Add Rate Limiting & Security

```bash
cd backend && npm install express-rate-limit helmet cors
```

**File:** `backend/src/server.ts`

```diff
+ import rateLimit from 'express-rate-limit';
+ import helmet from 'helmet';
+
+ app.use(helmet());
+ app.use(rateLimit({
+   windowMs: 60 * 1000, // 1 minute
+   max: 20, // 20 payment attempts per minute per IP
+   message: { error: 'Too many requests' },
+ }));
```

---

## Step 10 — Final Environment Variables for Production

Create `.env.production`:
```bash
SIMULATION_MODE=false
NODE_ENV=production
PORT=3001

# World Chain
BACKEND_WALLET_ADDRESS=0xYOUR_REAL_WALLET
BACKEND_WALLET_PRIVATE_KEY=<secret_manager_reference>
WLD_APP_ID=app_YOUR_APP_ID
WLD_ACTION_ID=YOUR_ACTION_ID
WORLD_CHAIN_RPC_URL=https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY

# Rates
COINGECKO_API_KEY=YOUR_KEY

# Off-ramp
YELLOW_CARD_API_KEY=YOUR_KEY
YELLOW_CARD_SECRET=YOUR_SECRET

# M-Pesa Daraja
MPESA_CONSUMER_KEY=YOUR_KEY
MPESA_CONSUMER_SECRET=YOUR_SECRET
MPESA_ENV=production
MPESA_SHORTCODE=YOUR_SHORTCODE
MPESA_B2B_SHORTCODE=YOUR_SHORTCODE
MPESA_INITIATOR_NAME=YOUR_INITIATOR
MPESA_PASSKEY=YOUR_PASSKEY
BACKEND_URL=https://your-backend.onrender.com

# Fees
FEE_PERCENT=0.5
MIN_KES_AMOUNT=10
MAX_KES_AMOUNT=150000
```

---

## Quick Reference — Files to Change

| File | Simulation Change | Production Change |
|---|---|---|
| `config.ts` | `SIMULATION_MODE=true` | `SIMULATION_MODE=false` |
| `offrampService.ts` | Uses `SimulatedOfframpService` | Switch to `YellowCardOfframpService` |
| `mpesaService.ts` | Uses `SimulatedMpesaService` | Switch to `DarajaMpesaService` |
| `worldChainListener.ts` | Uses `setTimeout` mock | Uses `viem` + World Chain RPC |
| `rateService.ts` | Returns hardcoded rates | Calls CoinGecko API |
| `payment.routes.ts` | Skips payload verification | Verifies MiniKit signature |
| `server.ts` | No rate limiting | Adds `helmet` + `express-rate-limit` |

---

*Good luck shipping! Open an issue if you hit blockers.*
