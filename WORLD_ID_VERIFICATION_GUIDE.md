# World ID Verification Troubleshooting Guide

## Current Issues

Your logs show two related problems, both stemming from **network connectivity in Docker**:

1. ❌ **World ID Verification Failing**: `EAI_AGAIN developer.world.org` (DNS resolution failure)
2. ❌ **Exchange Rate Service Failing**: `EAI_AGAIN api.kraken.com` (DNS resolution failure)

## Root Cause

The Docker container cannot reach external APIs due to DNS resolution failures. The error `EAI_AGAIN` specifically means the DNS server is temporarily unavailable or not properly configured.

## Fixes Applied

### 1. Switched to Kraken API Only (✅ Implemented)

Replaced CoinGecko with **Kraken** API in [backend/src/services/rateService.ts](backend/src/services/rateService.ts):
- **No API key required** (completely free)
- Direct WLD/USD and USD/KES price pairs from Kraken
- Falls back to cached rates or simulated rates if API is unavailable

### 2. Docker DNS Configuration (✅ Applied)

Added explicit DNS servers to both `docker-compose.yml` and `docker-compose.dev.yml`:

```yaml
dns:
  - 8.8.8.8      # Google DNS
  - 8.8.4.4      # Google DNS (backup)
  - 1.1.1.1      # Cloudflare DNS
```

**To apply this fix:**

```bash
# Restart containers with new DNS config
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d
```

## Verification Steps

### Step 1: Run Network Diagnostic (Optional but Recommended)

```bash
# From your backend container or host
npx tsx src/scripts/diagnoseNetwork.ts
```

This script tests:
- ✅ Worldcoin Developer API (https://developer.world.org) — **CRITICAL**
- ✅ Kraken API (https://api.kraken.com) — **CRITICAL for rates**

### Step 2: Test DNS from Inside Container

```bash
# From host
docker exec wld2mpesa-backend nslookup developer.world.org

# Should output:
# Name:   developer.world.org
# Address: 1.2.3.4  (actual IP)
```

If you get `NXDOMAIN` or `server can't find`, DNS isn't working.

### Step 3: Test API Connectivity

```bash
# From inside container
docker exec wld2mpesa-backend sh -c "wget -qO- https://api.kraken.com/0/public/Time 2>&1 | head -20"

# Or with curl
docker exec wld2mpesa-backend curl -I https://api.kraken.com/0/public/Time
```

You should get an HTTP response (even a 400 or 401 is success—it means DNS worked).

## If Verification Still Fails After Fixes

If `EAI_AGAIN` errors persist:

### Option A: Check Docker Host Network

```bash
# View Docker networks
docker network ls

# Inspect your network
docker inspect wld2mpesa_default  # or your network name

# Check DNS in running container
docker exec wld2mpesa-backend cat /etc/resolv.conf
```

### Option B: Restart Docker Daemon

```bash
# Linux
sudo systemctl restart docker

# macOS (using Docker Desktop)
# Click Docker icon → Restart

# Windows
# Right-click Docker icon → Settings → Reset → Restart Docker
```

### Option C: Use Host Network (Linux Only)

Edit `docker-compose.dev.yml`:

```yaml
backend:
  network_mode: "host"  # Use host machine's network
  # Remove ports: section when using host network
```

### Option D: Check Firewall

```bash
# Linux - Check if outbound HTTPS is allowed
sudo ufw status
sudo ufw allow out to any port 443 comment 'HTTPS out'

# macOS - Check System Preferences → Security & Privacy → Firewall

# Windows - Check Windows Defender Firewall
```

## If World ID Still Fails (Proof Validation Issue)

Once networking is verified, World ID may fail for other reasons:

### 1. Invalid World ID Credentials

```bash
# Check your environment variables
docker exec wld2mpesa-backend sh -c "echo WLD_APP_ID: $WLD_APP_ID; echo WLD_RP_ID: $WLD_RP_ID"

# Verify they're set in backend/.env (not committed to git)
cat backend/.env | grep WLD_
```

The error from logs shows staging environment:
```
WLD_APP_ID: app_ac9f43a974959b04b11b081c3740f932  
WLD_RP_ID: rp_c205808e8673f770
isStaging: true
```

### 2. Staging vs Production Mismatch

The code detects staging mode:
```typescript
const isStaging = !config.IS_PRODUCTION;  // true in dev
const verifyUrl = `https://developer.world.org/api/v4/verify/${config.WLD_RP_ID}${isStaging ? '?is_staging=true' : ''}`;
```

If using **staging credentials**, verify they're registered in World Developer Portal as **staging**.

### 3. Proof Expiration

World ID proofs expire in **5 minutes**. If the proof is old:
- Return to the app and re-verify
- Check frontend logs for proof generation time
- Verify system time is correct: `date` command

### 4. Protocol Version Mismatch

The logs show protocol v3.0:
```json
{
  "protocol_version": "3.0",
  "allow_legacy_proofs": true,
  ...
}
```

This is correct for most setups. If World ID upgraded to v4.0, you'd need:
- Update WLD_SIGNING_KEY in config
- Adjust verification request format

## Testing Checklist

- [ ] DNS configuration added to docker-compose files
- [ ] Containers restarted with `docker compose down && docker compose up`
- [ ] Run diagnostic script and verify all APIs are reachable
- [ ] Test World ID verification in browser
- [ ] Check backend logs for successful verification
- [ ] Verify rates endpoint returns data from Kraken

## Common Error Messages and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `EAI_AGAIN` | DNS resolution timeout | Add DNS config to docker-compose |
| `ECONNREFUSED` | Backend/API not running | Restart containers |
| `ETIMEDOUT` | Network unreachable | Check firewall/internet connection |
| `all_verifications_failed` + `invalid_proof` | DNS unreachable to developer.world.org | Apply DNS fix, then re-verify |
| `401 Unauthorized` | Invalid World ID credentials | Check WLD_APP_ID, WLD_RP_ID in .env |

## Need More Help?

1. Run the diagnostic script to identify exactly which APIs are failing
2. Check [World Developer Docs](https://docs.world.app/)
3. Check [Kraken API Docs](https://docs.kraken.com/rest/)
4. Review Docker DNS troubleshooting: https://docs.docker.com/config/containers/container-networking/
