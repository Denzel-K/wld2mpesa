# Production Deployment Guide

## Overview
Complete guide for transitioning from sandbox to production environment.

**Prerequisites**: Successful completion of sandbox testing as documented in [SANDBOX_SETUP.md](./SANDBOX_SETUP.md)

---

## Phase 1: Business & Legal Preparation

### Step 1: Company Registration

**Requirements**:
- Registered company in Kenya (for M-Pesa) or US/EU (for Bitnob)
- Business bank account
- Tax identification number

**Kenya Specific** (for Daraja integration):
- Company registration certificate
- Business permit/trade license
- Company PIN certificate
- Director ID copies
- Proof of physical address

### Step 2: Legal Documentation

**Required Documents**:

1. **Terms of Service**
   - Transaction limits and fees
   - Refund policy
   - User responsibilities
   - Liability limitations
   - Dispute resolution

2. **Privacy Policy**
   - Data collection practices
   - World ID data handling
   - M-Pesa data retention
   - User rights (GDPR/Kenya DPA)

3. **KYC/AML Policy** (if required by jurisdiction)
   - Customer identification procedures
   - Transaction monitoring
   - Suspicious activity reporting
   - Record keeping requirements

4. **Risk Disclosure**
   - Cryptocurrency volatility risks
   - Transaction irreversibility
   - Regulatory risks
   - Technology risks

**Recommended**: Consult with legal counsel familiar with fintech/crypto regulations in your operating jurisdictions.

### Step 3: Insurance & Bonding

Consider obtaining:
- Cyber liability insurance
- Errors & omissions insurance
- Fidelity bond for crypto custody

---

## Phase 2: Bitnob Production Setup

### Step 1: Request Production Access

1. Log in to Bitnob dashboard
2. Go to **Settings** → **Account Verification**
3. Submit production upgrade request
4. Provide:
   - Business registration documents
   - Director/owner KYC
   - Bank account details
   - Projected monthly volume
   - Use case description

### Step 2: Complete KYC Verification

**Required Documents**:
- Certificate of incorporation
- Memorandum and articles of association
- Director passport/ID
- Proof of business address
- 3 months business bank statements

**Timeline**: 3-7 business days

### Step 3: Generate Production API Keys

1. Go to **Developer** → **API Keys**
2. Click **Create Key**
3. Select environment: `Production`
4. Name: `wld2mpesa-production`
5. **CRITICAL**: Store keys securely (password manager/Vault)

### Step 4: Configure Production Webhook

1. Go to **Developer** → **Webhooks**
2. Add production webhook URL:
   ```
   https://api.yourdomain.com/api/webhooks/bitnob
   ```
3. Select all payout events
4. Copy webhook secret for signature verification
5. Test webhook with production verification

### Step 5: Fund Production Wallet

**Options**:

**Option A: Pre-funding**
- Deposit USDC to Bitnob wallet
- Faster payout processing
- Requires float management

**Option B: Credit Line**
- Request credit line from Bitnob
- Bitnob pays out, you settle later
- Slower processing (5-30 min)
- Requires credit approval

**Recommended for Launch**: Start with $2,000 USDC pre-funding

### Step 6: Set Transaction Limits

1. Go to **Settings** → **Limits**
2. Set per-transaction limits (recommend KES 150,000 max)
3. Set daily volume limits
4. Configure notification thresholds

---

## Phase 3: World App Production

### Step 1: Submit for Review

1. Go to https://developer.worldcoin.org/
2. Navigate to your app
3. Click **Submit for Review**
4. Provide:
   - App description
   - Screenshots/screen recording
   - Privacy policy URL
   - Terms of service URL
   - Support contact

### Step 2: Complete Security Review

World App team will review:
- Code quality
- Security practices
- User experience
- Compliance with MiniKit guidelines

**Timeline**: 1-2 weeks

### Step 3: Configure Production Domains

1. In Developer Portal, go to **Settings** → **Allowed Domains**
2. Remove localhost entries
3. Add production domain:
   ```
   https://yourdomain.com
   https://www.yourdomain.com
   ```
4. Add production API domain:
   ```
   https://api.yourdomain.com
   ```

### Step 4: Production Signing Key

1. Generate new signing key for production
2. Store separately from sandbox key
3. Update backend environment variable

---

## Phase 4: M-Pesa Daraja Production (If Using)

### Step 1: Apply for M-Pesa Business Account

1. Visit Safaricom business portal
2. Submit application for:
   - Paybill number (for merchant payments)
   - OR Business shortcode (for B2B)
   - OR B2C shortcode (for customer disbursements)

**Required Documents**:
- Company registration
- Trade license
- Bank account details
- Business plan
- Projected transaction volumes

**Timeline**: 4-8 weeks

### Step 2: Complete Daraja Certification

Once approved:
1. Complete API integration testing
2. Pass Safaricom certification tests
3. Receive production passkey
4. Sign commercial agreement

### Step 3: Production Configuration

```bash
MPESA_ENV="production"
MPESA_SHORTCODE="YOUR_SHORTCODE"
MPESA_PASSKEY="YOUR_PRODUCTION_PASSKEY"
MPESA_CONSUMER_KEY="YOUR_PROD_KEY"
MPESA_CONSUMER_SECRET="YOUR_PROD_SECRET"
```

---

## Phase 5: Infrastructure Setup

### Step 1: Production Server

**Recommended Stack**:
- **Platform**: AWS / Google Cloud / DigitalOcean
- **Server**: 2 vCPU, 4GB RAM minimum
- **OS**: Ubuntu 22.04 LTS
- **Database**: PostgreSQL 14+ (managed service recommended)
- **Cache**: Redis (managed or self-hosted)

**Required Services**:
- Application server (Node.js)
- PostgreSQL database
- Redis cache
- NGINX reverse proxy
- SSL certificate (Let's Encrypt)
- Monitoring (Datadog/New Relic)
- Log aggregation (Papertrail/LogDNA)

### Step 2: Database Migration

```bash
# Create production database
# Run migrations
# Verify schema
# Set up automated backups
```

**Backup Strategy**:
- Daily automated backups
- Point-in-time recovery
- Encrypted backup storage
- Test restore monthly

### Step 3: Security Hardening

**Required**:
- SSL/TLS everywhere
- Firewall rules (allow only necessary ports)
- DDoS protection (Cloudflare recommended)
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection
- CSRF tokens

**Secrets Management**:
- Use AWS Secrets Manager / HashiCorp Vault
- Rotate keys quarterly
- Never commit secrets to git
- Encrypt at rest

### Step 4: Monitoring Setup

**Required Alerts**:
- Transaction failure rate > 2%
- API error rate > 5%
- Database connection failures
- Blockchain RPC failures
- Insufficient balance warnings
- Unusual transaction volumes

**Dashboards**:
- Transaction volume and success rate
- Average settlement time
- Revenue and costs
- Active users
- System health metrics

---

## Phase 6: Production Configuration

### Backend .env.production

```bash
# Server
NODE_ENV="production"
PORT=3001
BACKEND_URL="https://api.yourdomain.com"

# Database (Use managed service credentials)
DATABASE_URL="postgresql://user:pass@prod-db-host:5432/wld2mpesa"
REDIS_URL="redis://prod-redis-host:6379"

# World Chain (Use dedicated RPC for production)
WORLD_CHAIN_RPC_URL="https://worldchain-mainnet.g.alchemy.com/v2/YOUR_PROD_KEY"
BACKEND_WALLET_ADDRESS="0xYOUR_PROD_WALLET"
BACKEND_WALLET_PRIVATE_KEY="vault://backend-wallet-key" # From secrets manager
ADMIN_PRIVATE_KEY="vault://admin-key" # From secrets manager

# World App Production
WLD_APP_ID="app_your_prod_app_id"
WLD_RP_ID="app_your_prod_app_id"
WLD_SIGNING_KEY="vault://worldcoin-signing-key"
WLD_LOGIN_ACTION_ID="wld2mpesa-login"
WLD_PAY_ACTION_ID="wld2mpesa-pay"

# Bitnob PRODUCTION
BITNOB_API_KEY="vault://bitnob-api-key"
BITNOB_CLIENT_ID="vault://bitnob-client-id"
BITNOB_SECRET_KEY="vault://bitnob-secret"
BITNOB_ENV="production"

# M-Pesa Production (If applicable)
MPESA_CONSUMER_KEY="vault://mpesa-key"
MPESA_CONSUMER_SECRET="vault://mpesa-secret"
MPESA_ENV="production"
MPESA_SHORTCODE="YOUR_SHORTCODE"
MPESA_PASSKEY="vault://mpesa-passkey"

# Business Configuration
FEE_PERCENT=2
GAS_BUFFER_KES=10
MIN_KES_AMOUNT=100
MAX_KES_AMOUNT=150000

# Security
JWT_SECRET="vault://jwt-secret"
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"
CLOUDFLARE_ENABLED="true"

# Notifications
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_USER="apikey"
EMAIL_PASSWORD="vault://sendgrid-key"
EMAIL_FROM_NAME="WLD2Mpesa"
EMAIL_FROM_ADDRESS="support@yourdomain.com"

# Monitoring
SENTRY_DSN="vault://sentry-dsn"
DATADOG_API_KEY="vault://datadog-key"
```

### Frontend Production Build

```bash
# .env.production
VITE_BACKEND_URL=https://api.yourdomain.com
VITE_WLD_APP_ID=app_your_prod_app_id

# Build
npm run build

# Deploy to CDN/static hosting
```

---

## Phase 7: Pre-Launch Checklist

### Technical Verification

- [ ] All API endpoints tested in production
- [ ] Webhook endpoints verified with Bitnob
- [ ] SSL certificate valid and auto-renewing
- [ ] Database backups configured and tested
- [ ] Monitoring dashboards active
- [ ] Alerting rules configured
- [ ] Rate limiting enabled
- [ ] DDoS protection active
- [ ] Secrets rotation procedure documented

### Financial Setup

- [ ] Bitnob wallet funded (minimum $2,000)
- [ ] Backend wallet funded with 0.05+ ETH
- [ ] Emergency fund allocated for refunds
- [ ] Accounting system integrated
- [ ] Bank account linked for settlements

### Legal & Compliance

- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] KYC/AML policy implemented (if required)
- [ ] Regulatory requirements reviewed
- [ ] Data protection compliance verified
- [ ] Insurance coverage confirmed

### Support & Operations

- [ ] Support email configured
- [ ] Escalation procedures documented
- [ ] Incident response plan ready
- [ ] Team trained on manual refund process
- [ ] Communication templates prepared

### Testing

- [ ] 10+ test transactions completed
- [ ] Refund process tested
- [ ] Webhook handling verified
- [ ] Error scenarios validated
- [ ] Mobile responsiveness confirmed
- [ ] World App integration tested

---

## Phase 8: Launch Strategy

### Soft Launch (Week 1)

**Approach**:
- Limit to 50 users
- Manual monitoring of each transaction
- Daily team check-ins
- Immediate issue resolution

**Criteria to proceed**:
- 95%+ transaction success rate
- 0 refund failures
- Average settlement < 3 minutes
- No critical errors

### Public Launch (Week 2+)

**Approach**:
- Remove user limits
- Enable full marketing
- Monitor closely
- Weekly performance reviews

**Success Metrics**:
- 100+ transactions in first week
- < 3% failure rate
- 4.5+ star rating
- Positive social media sentiment

---

## Phase 9: Post-Launch Operations

### Daily Operations

**Monitoring Checklist**:
- [ ] Review overnight transactions
- [ ] Check failed transactions queue
- [ ] Verify refund status
- [ ] Monitor Bitnob balance
- [ ] Check backend ETH balance
- [ ] Review error logs
- [ ] Respond to support tickets

### Weekly Operations

**Review Meeting Agenda**:
1. Transaction volume and trends
2. Success/failure rate analysis
3. Cost analysis (fees vs revenue)
4. User feedback summary
5. Technical issues and resolutions
6. Feature requests review

### Monthly Operations

**Tasks**:
- Rotate API keys
- Review access logs
- Update dependencies
- Security patch review
- Compliance audit
- Financial reconciliation

---

## Emergency Procedures

### Transaction Pipeline Failure

1. **Detection**: Alert fires for high failure rate
2. **Response**:
   - Immediately pause new transactions
   - Investigate root cause
   - Notify users via in-app message
3. **Recovery**:
   - Fix root cause
   - Test fix in sandbox
   - Gradual re-enablement
   - Process stuck transactions

### Bitnob API Outage

1. **Detection**: Bitnob health check fails
2. **Response**:
   - Switch to Daraja (if configured)
   - Or queue transactions for retry
   - Notify users of delay
3. **Recovery**:
   - Monitor Bitnob status
   - Resume when stable
   - Process queued transactions

### Backend Wallet Compromised

1. **Detection**: Unauthorized transaction detected
2. **Response**:
   - Immediately pause all transactions
   - Transfer remaining funds to cold wallet
   - Investigate breach
   - Notify affected users
3. **Recovery**:
   - Generate new wallet
   - Update all configurations
   - Implement additional security
   - Resume with new wallet

### Mass Refund Event

1. **Trigger**: Systemic failure requiring mass refunds
2. **Response**:
   - Generate refund report
   - Verify ADMIN_PRIVATE_KEY has gas
   - Process refunds in batches
   - Email affected users
3. **Follow-up**:
   - Root cause analysis
   - Process improvements
   - User communication

---

## Maintenance Windows

### Scheduled Maintenance

**Frequency**: Monthly, announced 48 hours in advance

**Procedure**:
1. Set maintenance banner in app
2. Pause new transactions
3. Wait for in-flight transactions to complete
4. Perform maintenance
5. Verify all systems
6. Resume operations
7. Remove maintenance banner

### Emergency Maintenance

**When**: Critical security patch or system failure

**Procedure**:
1. Immediate maintenance banner
2. Pause transactions
3. Emergency fix
4. Test in sandbox
5. Deploy to production
6. Verify and resume

---

## Support Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| Bitnob | support@bitnob.com | API issues, payouts |
| World App | dev-support@worldcoin.org | MiniKit issues |
| Safaricom | apisupport@safaricom.co.ke | M-Pesa issues |
| Hosting Provider | Per provider | Infrastructure |

---

## Success Metrics (Post-Launch)

**Target KPIs**:
- Transaction success rate: > 98%
- Average settlement time: < 2 minutes
- Refund success rate: 100%
- User satisfaction: > 4.5 stars
- Monthly transaction volume: 1000+
- Platform uptime: > 99.9%

**Review Schedule**:
- Daily: Transaction metrics
- Weekly: User feedback
- Monthly: Financial performance
- Quarterly: Strategic review

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-14 | Initial production setup guide |

---

**Next Review Date**: [Set 30 days after launch]

**Document Owner**: [Technical Lead]

