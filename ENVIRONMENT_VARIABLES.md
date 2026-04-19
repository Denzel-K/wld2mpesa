# Environment Variables Guide

This document lists all environment variables required for the WLD2Mpesa platform and explains how to obtain them.

## Table of Contents

1. [Required Variables](#required-variables)
2. [Bitnob API Setup](#bitnob-api-setup)
3. [World App Setup](#world-app-setup)
4. [M-Pesa Daraja Setup](#m-pesa-daraja-setup)
5. [World Chain Setup](#world-chain-setup)
6. [Optional Variables](#optional-variables)

---

## Required Variables

### Database & Infrastructure

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Run local PostgreSQL or use a service like Supabase, Neon, or AWS RDS |
| `REDIS_URL` | Redis connection string | Run local Redis or use Redis Cloud, Upstash, or AWS ElastiCache |
| `BACKEND_URL` | Public URL of your backend | Your deployed URL (e.g., `https://api.wld2mpesa.com`) |

### Bitnob API (For MPESA Off-ramp)

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `BITNOB_API_KEY` | Bearer token for API authentication | [Bitnob Dashboard](#bitnob-api-setup) → Developer → API Keys |
| `BITNOB_CLIENT_ID` | HMAC Client ID for request signing | [Bitnob Dashboard](#bitnob-api-setup) → Developer → API Keys |
| `BITNOB_SECRET_KEY` | HMAC Secret Key for request signing | [Bitnob Dashboard](#bitnob-api-setup) → Developer → API Keys |
| `BITNOB_ENV` | Environment selector | `sandbox` for testing, `production` for live |

### World App / MiniKit

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `WLD_APP_ID` | World App application ID | [World Developer Portal](#world-app-setup) |
| `WLD_RP_ID` | Relying Party ID (usually same as App ID) | [World Developer Portal](#world-app-setup) |
| `WLD_SIGNING_KEY` | Private key for signing World ID proofs | [World Developer Portal](#world-app-setup) → App Settings |
| `WLD_LOGIN_ACTION_ID` | Action ID for login verification | Create in Developer Portal (e.g., `wld2mpesa-login`) |
| `WLD_PAY_ACTION_ID` | Action ID for payment verification | Create in Developer Portal (e.g., `wld2mpesa-pay`) |

### World Chain Wallet (Escrow)

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `BACKEND_WALLET_ADDRESS` | Escrow wallet that receives WLD | Create a new wallet on World Chain or use existing |
| `BACKEND_WALLET_PRIVATE_KEY` | Private key for escrow wallet | **NEVER SHARE** - Export from wallet creation |

### M-Pesa Daraja API

| Variable | Description | How to Obtain |
|----------|-------------|---------------|
| `MPESA_CONSUMER_KEY` | Daraja API consumer key | [Safaricom Developer Portal](#m-pesa-daraja-setup) |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret | [Safaricom Developer Portal](#m-pesa-daraja-setup) |
| `MPESA_SHORTCODE` | M-Pesa shortcode for C2B | Get from Safaricom or use sandbox default `174379` |
| `MPESA_PASSKEY` | Passkey for STK push | Provided by Safaricom for your shortcode |

---

## Bitnob API Setup

Bitnob provides the off-ramp service that converts USDT to KES and sends to MPESA.

### Step-by-Step Setup

1. **Sign up at Bitnob**
   - Go to https://app.bitnob.com/
   - Create a business account
   - Complete KYC verification (required for production)

2. **Access Developer Dashboard**
   - Log in to your Bitnob account
   - Navigate to **Developer** → **API Keys** in the left sidebar

3. **Generate API Credentials**
   - Click **Create Key**
   - Choose environment: `Sandbox` (for testing) or `Production` (for live)
   - Give your key a descriptive name (e.g., `wld2mpesa-sandbox`)
   - Click **Generate**

4. **Copy Your Credentials**
   - **API Key (Bearer Token)**: Used in `Authorization: Bearer` header
   - **Client ID**: For HMAC authentication
   - **Secret Key**: For HMAC authentication (⚠️ **Only shown once!**)

   ![Bitnob API Keys Location](https://docs.bitnob.com/images/api-keys.png)

5. **Configure Sandbox vs Production**
   
   | Environment | URL | Use Case |
   |------------|-----|----------|
   | Sandbox | `https://sandboxapi.bitnob.co/api/v1` | Testing with fake funds |
   | Production | `https://api.bitnob.co/api/v1` | Live transactions |

6. **Set Environment Variables**
   ```bash
   BITNOB_API_KEY=your_bearer_token_here
   BITNOB_CLIENT_ID=your_client_id_here
   BITNOB_SECRET_KEY=your_secret_key_here
   BITNOB_ENV=sandbox  # Change to 'production' when ready
   ```

### Testing Your Setup

```bash
# Test Bitnob API connection
curl --request GET \
  --url https://sandboxapi.bitnob.co/api/v1/rates/exchange?from=USD&to=KES \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### Supported Countries for Payouts

Bitnob supports mobile money payouts to:
- 🇰🇪 Kenya (MPESA)
- 🇬🇭 Ghana (MTN, Vodafone)
- 🇺🇬 Uganda (MTN, Airtel)
- 🇳🇬 Nigeria
- 🇷🇼 Rwanda
- 🇲🇱 Mali
- 🇧🇫 Burkina Faso
- 🇧🇯 Benin
- 🇨🇲 Cameroon
- 🇨🇮 Ivory Coast
- 🇸🇳 Senegal
- 🇹🇬 Togo
- 🇬🇳 Guinea Conakry

---

## World App Setup

World ID authentication is required for user verification before transactions.

### Step-by-Step Setup

1. **Create World App**
   - Go to https://developer.worldcoin.org/
   - Sign up with your email
   - Click **Create App**
   - Choose **Mini Kit** as the app type

2. **Get App ID**
   - After creation, you'll see your App ID (e.g., `app_xxxxx`)
   - Copy this to `WLD_APP_ID`

3. **Create Action IDs**
   - Go to **Actions** tab
   - Create two actions:
     - **Login Action**: `wld2mpesa-login` (for user verification)
     - **Payment Action**: `wld2mpesa-pay` (for payment verification)
   - Set each to **Orb** verification level for security

4. **Get Signing Key**
   - Go to **Settings** → **Advanced**
   - Generate or copy your **Signing Key**
   - This is used to verify World ID proofs

5. **Configure MiniKit**
   - Add your domain to **Allowed Domains**
   - For local development, add `http://localhost:3000`
   - For production, add your deployed URL

### Environment Variables

```bash
WLD_APP_ID=app_your_app_id_here
WLD_RP_ID=app_your_app_id_here  # Usually same as WLD_APP_ID
WLD_SIGNING_KEY=0x_your_signing_key_here
WLD_LOGIN_ACTION_ID=wld2mpesa-login
WLD_PAY_ACTION_ID=wld2mpesa-pay
```

---

## M-Pesa Daraja Setup

M-Pesa Daraja API handles the final disbursement to MPESA.

### Step-by-Step Setup

1. **Register at Safaricom Developer Portal**
   - Go to https://developer.safaricom.co.ke/
   - Create an account with your business details
   - Complete email verification

2. **Create an App**
   - Click **Create New App**
   - Select **MPesa Express (STK Push)** and **Account Balance** APIs
   - Submit for approval

3. **Get Consumer Credentials**
   - Once approved, go to your app dashboard
   - Copy **Consumer Key** and **Consumer Secret**

4. **Get Passkey**
   - For sandbox: Use test credentials provided
   - For production: Contact Safaricom for your shortcode and passkey

5. **Sandbox Testing**
   - Use default sandbox shortcode: `174379`
   - Test with phone number: `254708374149`
   - PIN: Any 4 digits (e.g., `1234`)

### Environment Variables

```bash
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_ENV=sandbox  # Change to 'production' when ready
MPESA_SHORTCODE=174379  # Your M-Pesa shortcode
MPESA_PASSKEY=your_passkey_here
```

---

## World Chain Setup

World Chain is the blockchain where WLD tokens are held and swapped.

### Step-by-Step Setup

1. **Get RPC URL**
   - Recommended: Use Alchemy (https://www.alchemy.com/)
   - Sign up and create a new app
   - Select **World Chain Mainnet**
   - Copy the HTTPS URL

2. **Create Escrow Wallet**
   - Use MetaMask or any EVM wallet
   - Add World Chain Mainnet network:
     - Network Name: World Chain
     - RPC URL: `https://worldchain-mainnet.g.alchemy.com/v2/YOUR_KEY`
     - Chain ID: 480
     - Currency Symbol: ETH
     - Block Explorer: `https://worldchain-mainnet.explorer.alchemy.com/`
   - Create a new wallet or use existing
   - Fund with some ETH for gas fees

3. **Important Security Notes**
   - Store `BACKEND_WALLET_PRIVATE_KEY` securely (use AWS Secrets Manager, etc.)
   - Never commit private keys to git
   - Set up monitoring for the escrow wallet

### Environment Variables

```bash
WORLD_CHAIN_RPC_URL=https://worldchain-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BACKEND_WALLET_ADDRESS=0x_your_escrow_wallet_address
BACKEND_WALLET_PRIVATE_KEY=your_private_key_here  # NEVER SHARE!

# For automated DEX swaps (WLD → USDC)
ADMIN_PRIVATE_KEY=your_private_key_here  # Same as BACKEND_WALLET_PRIVATE_KEY or separate
```

### Token Contracts on World Chain

| Token | Address |
|-------|---------|
| WLD | `0x2cFc85d8E48F8EAB294be644d9E256F01c2384a0` |
| USDC | `0x79A02482A8849733928120FE3c23eA97B068D2e3` |
| Uniswap V3 Router | `0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743` |

---

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |
| `FEE_PERCENT` | Platform fee percentage | `0.5` |
| `MIN_KES_AMOUNT` | Minimum transaction amount | `10` |
| `MAX_KES_AMOUNT` | Maximum transaction amount | `150000` |
| `CLOUDFLARE_ENABLED` | Enable Cloudflare IP extraction | `false` |
| `TRANSACTION_LOG_PATH` | Path for transaction logs | `./data/transactions.json` |

---

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore
.env
*.pem
*.key
data/
```

### 2. Use Secret Managers in Production

- **AWS**: AWS Secrets Manager
- **GCP**: Secret Manager
- **Azure**: Key Vault
- **Render/DigitalOcean**: Environment variables in dashboard

### 3. Rotate Keys Regularly

- Bitnob API keys: Rotate monthly
- M-Pesa credentials: Rotate quarterly
- World ID signing keys: Rotate on suspicion of compromise

### 4. Monitor API Usage

Set up alerts for:
- Unusual transaction volumes
- Failed authentication attempts
- High error rates from Bitnob/M-Pesa

---

## Quick Start Checklist

Before starting development, ensure you have:

- [ ] Bitnob account with API keys
- [ ] World App created with Action IDs
- [ ] M-Pesa Daraja sandbox credentials
- [ ] World Chain RPC URL (Alchemy recommended)
- [ ] PostgreSQL database running
- [ ] Redis running
- [ ] All environment variables in `.env` file

---

## Troubleshooting

### Bitnob API Errors

| Error | Solution |
|-------|----------|
| `401 Unauthorized` | Check `BITNOB_API_KEY` is correct and not expired |
| `400 Bad Request` | Verify phone number format (2547XXXXXXXX) |
| `403 Forbidden` | Ensure account is verified and has sufficient balance |
| `429 Rate Limited` | Implement exponential backoff in your code |

### World ID Errors

| Error | Solution |
|-------|----------|
| `Invalid proof` | Check `WLD_SIGNING_KEY` matches the one in Developer Portal |
| `Action not found` | Verify `WLD_LOGIN_ACTION_ID` exists in your app |

### M-Pesa Errors

| Error | Solution |
|-------|----------|
| `Invalid credentials` | Regenerate Consumer Key/Secret in Daraja portal |
| `STK push not working` | Ensure passkey matches your shortcode |

---

## Support & Resources

- **Bitnob API Docs**: https://docs.bitnob.com/
- **World ID Docs**: https://docs.worldcoin.org/
- **M-Pesa Daraja Docs**: https://developer.safaricom.co.ke/docs
- **World Chain Docs**: https://docs.worldcoin.org/world-chain

For issues specific to this platform, check the [GitHub Issues](https://github.com/your-repo/wld2mpesa/issues) or contact the development team.
