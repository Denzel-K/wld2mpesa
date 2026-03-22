/**
 * diagnoseNetwork.ts — Diagnostic script to test external API connectivity
 * 
 * Run with: npx tsx src/scripts/diagnoseNetwork.ts
 */


const APIs = [
  {
    name: 'Worldcoin Developer API',
    url: 'https://developer.world.org/api/v4/verify',
    method: 'HEAD',
    critical: true,
  },
  {
    name: 'Kotani Pay API',
    url: 'https://sandbox-api.kotanipay.io/api/v1/health-check', // Kotani has specific health check endpoints
    method: 'GET',
    critical: true,
  },
];

async function testAPI(api: typeof APIs[0]) {
  try {
    console.log(`\n🔍 Testing ${api.name}...`);
    console.log(`   URL: ${api.url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(api.url, {
      method: api.method,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 405) {
      // 405 is OK for HEAD requests on APIs that don't support them
      console.log(`✅ PASS: ${response.status} ${response.statusText}`);
      return true;
    } else {
      console.log(`⚠️  Got response ${response.status} ${response.statusText}`);
      // Some response is better than no response
      return api.critical ? false : true;
    }
  } catch (err: any) {
    console.error(`❌ FAIL: ${err.message || err.code}`);
    if (err.cause?.code === 'EAI_AGAIN') {
      console.log('   → DNS resolution failed (likely Docker DNS issue)');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('   → Connection refused (firewall or service not running)');
    } else if (err.code === 'ETIMEDOUT' || err.name === 'AbortError') {
      console.log('   → Connection timeout (network unreachable)');
    }
    return false;
  }
}

async function diagnose() {
  console.log('🔧 Network Connectivity Diagnostic\n');
  console.log('Testing Docker container network access...');

  const results: Record<string, boolean> = {};

  for (const api of APIs) {
    results[api.name] = await testAPI(api);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY\n');

  const allPass = Object.values(results).every((v) => v);

  for (const api of APIs) {
    const status = results[api.name] ? '✅' : '❌';
    const note = api.critical ? ' [CRITICAL]' : '';
    console.log(`${status} ${api.name}${note}`);
  }

  if (!allPass) {
    console.log('\n⚠️  Some APIs are unreachable. Recommendations:\n');
    console.log('1. Check Docker Network:');
    console.log('   docker network ls');
    console.log('   docker inspect <network> | grep -A 5 "IPAM"');
    console.log('\n2. Check DNS Configuration:');
    console.log('   Run from container: nslookup developer.world.org');
    console.log('   Or add to docker-compose: dns: ["8.8.8.8", "8.8.4.4"]');
    console.log('\n3. Check Docker DNS:');
    console.log('   cat /etc/resolv.conf (inside container)');
    console.log('\n4. If running Docker on your machine:');
    console.log('   - Restart Docker daemon');
    console.log('   - Check internet connectivity on host');
    console.log('   - Verify firewall settings');
  } else {
    console.log('\n✅ All required APIs are reachable!');
    console.log('\nIf World ID verification still fails, the issue may be:');
    console.log('- Invalid World ID credentials (WLD_APP_ID, WLD_RP_ID, etc.)');
    console.log('- Proof being expired or malformed');
    console.log('- Environment mismatch (staging vs production)');
  }
}

diagnose().catch(console.error);
