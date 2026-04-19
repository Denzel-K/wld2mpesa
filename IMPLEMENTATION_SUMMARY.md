# WLD2Mpesa Implementation Summary

## Overview

This document summarizes the implementation of the full transaction flow for the WLD2Mpesa platform, enabling users to:
1. Pay with WLD (Worldcoin) tokens
2. Swap WLD → USDC via DEX
3. Off-ramp USDC → KES via Bitnob
4. Receive funds in MPESA (Send Money, Paybill, Till Number, Pochi la Biashara)

## Transaction Flow

```
User WLD Balance → WLD Payment → DEX Swap (WLD→USDC) → Bitnob Payout → MPESA
     ↓                ↓              ↓                      ↓              ↓
   World Chain    MiniKit pay   Uniswap V3            Bitnob API    M-Pesa
   Wallet         verify        on World Chain        off-ramp      mobile money
```

## Implementation Details

### 1. Bitnob API Integration

**File**: `backend/src/services/bitnobService.ts`

The BitnobService provides comprehensive integration with Bitnob's Payout API:

- **Endpoint**: `POST /wallets/payout/initialize`
- **Environment**: 
  - Sandbox: `https://sandboxapi.bitnob.co/api/v1`
  - Production: `https://api.bitnob.co/api/v1`
- **Authentication**: Bearer Token (`Authorization: Bearer {BITNOB_API_KEY}`)

**Key Methods**:
- `initiatePayout()`: Creates a mobile money payout to MPESA
- `getPayoutStatus()`: Checks payout status via `GET /wallets/payout/{id}`
- `initiateSwap()`: Implements IOfframpService interface for the payment pipeline
- `checkSwapStatus()`: Polls payout status for transaction completion
- `getExchangeRate()`: Fetches USD to KES exchange rates
- `validatePhoneNumber()`: Validates phone numbers for supported countries

**Supported Countries**: Kenya, Ghana, Uganda, Nigeria, Rwanda, Mali, Burkina Faso, Benin, Cameroon, Ivory Coast, Senegal, Togo, Guinea Conakry

**Request Format**:
```json
{
  "amount": 100000,  // Amount in cents (1000 KES = 100000)
  "customerEmail": "customer@wld2mpesa.app",
  "reference": "TXN-12345",
  "country": "Kenya",
  "currency": "KES",
  "beneficiary": {
    "phoneNumber": "254712345678",
    "country": "Kenya",
    "type": "momo",
    "network": "mpesa"
  }
}
```

### 2. Offramp Service Wrapper

**File**: `backend/src/services/offrampService.ts`

The OfframpService acts as a thin wrapper around BitnobService for backward compatibility and separation of concerns.

### 3. Payment Pipeline

**File**: `backend/src/services/paymentService.ts`

The RealPaymentService orchestrates the complete transaction flow:

1. **Verify WLD Transfer**: Uses `worldChainListener.waitForWldTransfer()` to confirm on-chain payment
2. **Initiate Bitnob Payout**: Calls `offrampService.initiateSwap()` to start the MPESA payout
3. **Rebalancing Swap**: Executes `swapService.swapWldForUsdc()` for automated liquidity management
4. **Poll for Completion**: Monitors payout status until `COMPLETED` or `FAILED`

**Transaction Status Flow**:
```
INITIATED → PENDING_CONFIRMATION → CONFIRMED → OFFRAMP_INITIATED → SETTLED
                                      ↓
                                   FAILED (if error occurs)
```

### 4. DEX Swap Service

**File**: `backend/src/services/swapService.ts`

Handles automated WLD → USDC swapping on World Chain using Uniswap V3:

- **Router**: `0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743`
- **WLD Token**: `0x2cFc85d8E48F8EAB294be644d9E256F01c2384a0`
- **USDC Token**: `0x79A02482A8849733928120FE3c23eA97B068D2e3`
- **Fee Tier**: 1% (10000)

### 5. Webhook Handler

**File**: `backend/src/routes/bitnob.routes.ts`

Handles incoming webhooks from Bitnob for real-time payout status updates:

- **Endpoint**: `POST /api/webhooks/bitnob`
- **Events Handled**:
  - `payout.initiated` / `payout.pending`
  - `payout.success` / `payout.completed`
  - `payout.failed` / `payout.rejected`
  - `payout.reversed`

**Additional Endpoints**:
- `GET /api/webhooks/bitnob/status/:transactionId`: Manual status check
- `POST /api/webhooks/bitnob/test`: API connectivity test (development only)

### 6. Wallet Balance Integration

**Files**:
- `backend/src/routes/payment.routes.ts`: Added `/api/payment/balance/:walletAddress`
- `frontend/src/lib/api.ts`: Added `fetchBalance()` function

Provides real-time WLD balance checks from World Chain.

### 7. Environment Variables

**Updated Files**:
- `backend/.env.example`: Added comprehensive documentation
- `backend/src/config.ts`: Added `BITNOB_CLIENT_ID` and `BITNOB_SECRET_KEY`

**New Variables**:
```bash
BITNOB_API_KEY=                    # Bearer Token
BITNOB_CLIENT_ID=                   # HMAC Client ID
BITNOB_SECRET_KEY=                  # HMAC Secret Key
BITNOB_ENV=sandbox                 # sandbox | production
```

## How to Obtain API Credentials

### Bitnob API Setup

1. **Sign up**: https://app.bitnob.com/
2. **Navigate**: Developer → API Keys
3. **Create Key**: Choose Sandbox or Production
4. **Copy Credentials**:
   - API Key (Bearer Token)
   - Client ID
   - Secret Key (⚠️ only shown once!)

### World App Setup

1. **Create App**: https://developer.worldcoin.org/
2. **Get App ID**: Copy from dashboard
3. **Create Actions**:
   - `wld2mpesa-login` (for login)
   - `wld2mpesa-pay` (for payments)
4. **Get Signing Key**: Settings → Advanced

### M-Pesa Daraja Setup

1. **Register**: https://developer.safaricom.co.ke/
2. **Create App**: Select MPesa Express API
3. **Copy Credentials**: Consumer Key, Consumer Secret
4. **Get Passkey**: From Safaricom for your shortcode

## API Testing

### Test Bitnob API Connection

```bash
curl --request POST \
  --url http://localhost:3001/api/webhooks/bitnob/test \
  --header 'Content-Type: application/json'
```

### Check Wallet Balance

```bash
curl --request GET \
  --url http://localhost:3001/api/payment/balance/0xWalletAddressHere
```

### Check Payout Status

```bash
curl --request GET \
  --url http://localhost:3001/api/webhooks/bitnob/status/TXN-12345
```

## Configuration Checklist

Before deploying, ensure:

- [ ] Bitnob account created with API keys
- [ ] World App created with Action IDs
- [ ] M-Pesa Daraja credentials obtained
- [ ] World Chain RPC URL configured (Alchemy recommended)
- [ ] Escrow wallet funded with ETH for gas
- [ ] PostgreSQL database running
- [ ] Redis running
- [ ] All environment variables in `.env` file
- [ ] Webhook URL configured in Bitnob dashboard: `{BACKEND_URL}/api/webhooks/bitnob`

## Security Considerations

1. **Never commit secrets**: Use `.gitignore` for `.env` files
2. **Use secret managers**: AWS Secrets Manager, GCP Secret Manager, etc.
3. **Rotate keys regularly**: Monthly for Bitnob, quarterly for M-Pesa
4. **Monitor transactions**: Set up alerts for unusual activity
5. **Secure private keys**: Store `BACKEND_WALLET_PRIVATE_KEY` in encrypted storage

## Error Handling

### Common Bitnob Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid API key | Verify `BITNOB_API_KEY` |
| `400 Bad Request` | Invalid phone format | Ensure 2547XXXXXXXX format |
| `403 Forbidden` | Unverified account | Complete KYC on Bitnob |
| `429 Rate Limited` | Too many requests | Implement exponential backoff |

### Common World ID Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid proof` | Wrong signing key | Check `WLD_SIGNING_KEY` |
| `Action not found` | Missing action ID | Verify action exists in portal |

## Next Steps

1. **Testing**: Run full transaction flow in sandbox mode
2. **Monitoring**: Set up logging and alerting
3. **Scaling**: Implement Redis caching for rates
4. **Compliance**: Ensure KYC/AML requirements are met
5. **Documentation**: Share API docs with frontend team

## Support Resources

- **Bitnob API Docs**: https://docs.bitnob.com/
- **World ID Docs**: https://docs.worldcoin.org/
- **M-Pesa Daraja**: https://developer.safaricom.co.ke/docs
- **World Chain**: https://docs.worldcoin.org/world-chain
