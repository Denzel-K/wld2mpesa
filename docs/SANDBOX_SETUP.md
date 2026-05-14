# Sandbox Testing Setup Guide

## Overview
This guide walks through complete sandbox testing setup for WLD2Mpesa before production deployment.

---

## Phase 1: Bitnob Sandbox Setup

### Step 1: Create Bitnob Account

1. Visit https://app.bitnob.com/
2. Click "Sign Up"
3. Select **Business Account**
4. Fill in company details:
   - Company Name: [Your company name]
   - Email: [Business email]
   - Phone: [Business phone]
5. Verify email

### Step 2: Complete Business Profile

1. Log in to Bitnob dashboard
2. Navigate to **Profile** → **Business Information**
3. Fill in:
   - Business registration number
   - Business address
   - Director/owner information
   - Nature of business (select "Financial Services" or "Technology")

**Note**: For sandbox testing, KYC verification is optional. You can proceed with default limits.

### Step 3: Generate Sandbox API Keys

1. Go to **Developer** → **API Keys** in left sidebar
2. Click **Create Key**
3. Select environment: `Sandbox`
4. Name: `wld2mpesa-sandbox`
5. Click **Generate**
6. **IMPORTANT**: Copy all three values immediately:
   - **API Key** (Bearer token)
   - **Client ID** (for HMAC)
   - **Secret Key** (for HMAC) - **Shown only once!**

Store these securely in your password manager.

### Step 4: Test API Connectivity

```bash
curl --request GET \
  --url https://sandboxapi.bitnob.co/api/v1/rates/exchange?from=USD&to=KES \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

Expected response:
```json
{
  "data": {
    "rate": 129.50,
    "from": "USD",
    "to": "KES"
  }
}
```

### Step 5: Fund Sandbox Wallet

1. In Bitnob dashboard, go to **Wallets**
2. Select **Sandbox** tab
3. Click **Add Funds**
4. Bitnob provides test USDC for sandbox
5. Request KES equivalent for testing (sandbox KES is simulated)

**Sandbox Limitations**:
- Maximum test balance: $10,000 USD equivalent
- Test funds reset periodically
- Cannot withdraw to real bank accounts

### Step 6: Configure Webhook Endpoint

1. In Bitnob dashboard, go to **Developer** → **Webhooks**
2. Click **Add Webhook**
3. Enter your ngrok/public URL:
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/bitnob
   ```
4. Select events:
   - `payout.initialized`
   - `payout.success`
   - `payout.failed`
   - `payout.reversed`
5. Save webhook configuration
6. Copy the webhook secret for signature verification

**For Local Testing**:
```bash
# Install ngrok
npm install -g ngrok

# Expose local backend
ngrok http 3001

# Use the https URL in Bitnob webhook settings
```

---

## Phase 2: World Developer Portal Setup

### Step 1: Create Developer Account

1. Visit https://developer.worldcoin.org/
2. Sign up with email
3. Verify email
4. Complete developer profile

### Step 2: Create MiniKit App

1. Click **Create App**
2. Select **MiniKit** as app type
3. Fill in app details:
   - App Name: `WLD2Mpesa`
   - Description: `Send WLD to M-Pesa in Kenya`
   - Category: `Finance`
4. Note your **App ID** (format: `app_xxxxx`)

### Step 3: Configure Actions

1. Go to **Actions** tab
2. Create **Login Action**:
   - Action ID: `wld2mpesa-login`
   - Name: `WLD2Mpesa Login`
   - Verification Level: `Orb`
3. Create **Payment Action**:
   - Action ID: `wld2mpesa-pay`
   - Name: `WLD2Mpesa Payment`
   - Verification Level: `Orb`

### Step 4: Get Signing Key

1. Go to **Settings** → **Advanced**
2. Click **Generate Signing Key** (if not exists)
3. Copy the signing key
4. Store securely - this verifies World ID proofs

### Step 5: Configure Domains

1. Go to **Settings** → **Allowed Domains**
2. Add for development:
   ```
   http://localhost:3000
   https://localhost:3000
   ```
3. Add your ngrok URL for mobile testing:
   ```
   https://your-ngrok-url.ngrok.io
   ```

### Step 6: Test in World App

1. Download World App (iOS/Android)
2. Complete World ID verification (requires Orb visit)
3. Enable developer mode in World App settings
4. Open your MiniKit app URL in World App browser

---

## Phase 3: M-Pesa Daraja Sandbox (Optional)

### If Using Daraja Integration

### Step 1: Register at Safaricom

1. Visit https://developer.safaricom.co.ke/
2. Create account with business email
3. Verify email

### Step 2: Create App

1. Click **Create New App**
2. Select APIs:
   - MPesa Express (STK Push)
   - Account Balance
   - Transaction Status
3. Submit for approval

### Step 3: Get Sandbox Credentials

Default sandbox credentials (for testing):
- **Consumer Key**: Provided in dashboard
- **Consumer Secret**: Provided in dashboard
- **Shortcode**: `174379`
- **Passkey**: Provided in dashboard
- **Test Phone**: `254708374149`
- **Test PIN**: `1234`

### Step 4: Test STK Push

```bash
curl --location 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
--data '{
    "BusinessShortCode": 174379,
    "Password": "YOUR_ENCODED_PASSWORD",
    "Timestamp": "20260114120000",
    "TransactionType": "CustomerPayBillOnline",
    "Amount": 1,
    "PartyA": 254708374149,
    "PartyB": 174379,
    "PhoneNumber": 254708374149,
    "CallBackURL": "https://your-ngrok-url.ngrok.io/api/mpesa/callback",
    "AccountReference": "Test",
    "TransactionDesc": "Test Payment"
}'
```

---

## Phase 4: Environment Configuration

### Backend .env Configuration

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wld2mpesa?schema=public"
REDIS_URL="redis://localhost:6379"

# Server
PORT=3001
NODE_ENV="development"
BACKEND_URL="https://your-ngrok-url.ngrok.io" # Your public URL

# World Chain
WORLD_CHAIN_RPC_URL="https://worldchain-mainnet.g.alchemy.com/public"
BACKEND_WALLET_ADDRESS="0xYOUR_BACKEND_WALLET"
BACKEND_WALLET_PRIVATE_KEY="your_private_key" # For transaction signing
ADMIN_PRIVATE_KEY="your_private_key" # Same as above for refunds

# World App (from Developer Portal)
WLD_APP_ID="app_xxxxx"
WLD_RP_ID="app_xxxxx"
WLD_SIGNING_KEY="0x_your_signing_key"
WLD_LOGIN_ACTION_ID="wld2mpesa-login"
WLD_PAY_ACTION_ID="wld2mpesa-pay"

# Bitnob SANDBOX
BITNOB_API_KEY="sandbox_your_api_key"
BITNOB_CLIENT_ID="your_client_id"
BITNOB_SECRET_KEY="your_secret_key"
BITNOB_ENV="sandbox"

# M-Pesa Daraja (Optional)
MPESA_CONSUMER_KEY="your_consumer_key"
MPESA_CONSUMER_SECRET="your_consumer_secret"
MPESA_ENV="sandbox"
MPESA_SHORTCODE="174379"
MPESA_PASSKEY="your_passkey"

# Fees
FEE_PERCENT=2 # Set to 2% for competitive testing
GAS_BUFFER_KES=10
MIN_KES_AMOUNT=100
MAX_KES_AMOUNT=50000

# Security
JWT_SECRET="your_random_jwt_secret"
```

### Frontend .env Configuration

```bash
VITE_BACKEND_URL=/api
VITE_WLD_APP_ID=app_xxxxx
```

---

## Phase 5: Testing Checklist

### Pre-Test Setup

- [ ] Backend running locally (port 3001)
- [ ] Frontend running locally (port 3000)
- [ ] ngrok tunnel active
- [ ] Bitnob webhook configured with ngrok URL
- [ ] World App domains configured
- [ ] Database migrated and accessible
- [ ] Redis running
- [ ] Backend wallet has 0.01+ ETH on World Chain
- [ ] Bitnob sandbox wallet funded

### Test Scenario 1: Happy Path

**Goal**: Complete successful transaction end-to-end

**Steps**:
1. Open mini-app in World App
2. Select "Send Money"
3. Enter phone: `254708374149` (Safaricom test number)
4. Enter amount: KES 500
5. Review and confirm
6. Complete World ID verification
7. Confirm payment in World App
8. Wait for status updates

**Expected Results**:
- Transaction status: `SETTLED`
- M-Pesa notification received (in sandbox)
- Bitnob webhook received
- No errors in logs

**Success Criteria**: ✅ Transaction completes in < 3 minutes

### Test Scenario 2: Invalid Phone Number

**Goal**: Verify graceful rejection

**Steps**:
1. Initiate transaction
2. Enter invalid phone: `254999999999`
3. Complete payment flow

**Expected Results**:
- Bitnob rejects payout
- Transaction status: `FAILED`
- User sees clear error message
- Refund initiated automatically

**Success Criteria**: ✅ User gets refund within 5 minutes

### Test Scenario 3: Expired Transaction

**Goal**: Test timeout handling

**Steps**:
1. Initiate transaction
2. Wait 10 minutes without confirming in World App
3. Try to confirm after expiry

**Expected Results**:
- Backend rejects expired confirmation
- Transaction marked `FAILED`
- No refund needed (WLD not sent)

### Test Scenario 4: Webhook Failure Recovery

**Goal**: Test polling fallback when webhooks fail

**Steps**:
1. Initiate and complete transaction
2. Block webhook endpoint temporarily
3. Verify transaction still settles via polling

**Expected Results**:
- Transaction settles despite webhook failure
- Logs show "Falling back to polling"

### Test Scenario 5: Insufficient Balance

**Goal**: Verify pre-flight checks

**Steps**:
1. Request Bitnob balance to be set to $0
2. Attempt transaction

**Expected Results**:
- Transaction rejected at initiation
- Clear error: "Insufficient platform liquidity"
- No WLD deducted from user

### Test Scenario 6: Refund Mechanism

**Goal**: Verify refund works correctly

**Steps**:
1. Create transaction that will fail
2. Trigger failure
3. Wait for auto-refund
4. Verify WLD returned to user wallet

**Expected Results**:
- Refund status: `REFUNDED`
- On-chain transaction hash recorded
- User sees refund in World App

---

## Phase 6: Debugging Tools

### Backend Debug Endpoints

```bash
# Check Bitnob API connection
curl https://your-ngrok-url.ngrok.io/api/webhooks/bitnob/test \
  -X POST

# Check transaction status
curl https://your-ngrok-url.ngrok.io/api/webhooks/bitnob/status/TXN-xxx

# View system health
curl https://your-ngrok-url.ngrok.io/api/health
```

### Frontend Developer Mode

1. Enable Eruda console:
   ```bash
   VITE_ENABLE_ERUDA=true npm run dev
   ```
2. Access console in mobile browser
3. View MiniKit logs and errors

### Logs to Monitor

```bash
# Docker logs
docker-compose logs -f backend

# Filter for specific transaction
docker-compose logs -f backend | grep "TXN-xxx"

# Filter for errors
docker-compose logs -f backend | grep "ERROR"
```

---

## Phase 7: Sandbox Limitations

### Bitnob Sandbox

- **No real M-Pesa**: Notifications are simulated
- **Rate limits**: 100 requests/minute
- **Balance caps**: $10,000 maximum
- **Reset schedule**: Test data cleared weekly

### World App

- **Test WLD only**: Cannot use real mainnet WLD
- **Orb verification required**: Must visit Orb for World ID
- **Developer mode**: Must be enabled manually

### Daraja Sandbox

- **Simulated STK push**: No real phone notification
- **Fixed test numbers**: Only `254708374149` works
- **No real settlement**: All transactions are simulated

---

## Phase 8: Exit Criteria

Before moving to production, verify:

- [ ] 20+ successful sandbox transactions
- [ ] 0 refund failures
- [ ] All error scenarios handled gracefully
- [ ] Webhooks working reliably
- [ ] Average settlement time < 2 minutes
- [ ] No critical errors in logs
- [ ] Bitnob integration stress tested

---

## Troubleshooting

### Bitnob API Returns 401

- Check API key is correct
- Verify environment is set to `sandbox`
- Ensure key hasn't expired

### Webhooks Not Received

- Verify ngrok is running
- Check webhook URL in Bitnob dashboard
- Test endpoint manually with curl

### World App Won't Load

- Verify domain is in allowed list
- Check MiniKit is initialized correctly
- Look for CORS errors in console

### Transactions Stuck

- Check backend has ETH for gas
- Verify Bitnob balance is sufficient
- Review logs for pipeline errors

### Refunds Failing

- Ensure ADMIN_PRIVATE_KEY is set
- Verify backend wallet has ETH
- Check World Chain RPC is accessible

---

## Next Steps

After successful sandbox testing:
1. Review [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)
2. Apply for Bitnob production access
3. Complete World App review process
4. Prepare compliance documentation

