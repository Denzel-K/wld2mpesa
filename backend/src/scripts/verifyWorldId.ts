import { config } from '../config';

/**
 * verifyWorldId.ts
 * 
 * Diagnostic script to check if World ID actions exist in the Developer Portal.
 * Runs on startup to catch configuration errors early.
 */

async function checkAction(actionId: string) {
  console.log(`\n🔍 Checking Action: ${actionId}`);
  console.log(`   App ID: ${config.WLD_APP_ID}`);

  // We use a dummy payload to check if the action exists.
  // A 400 "Action not found" means the ID is wrong.
  // A 400 "Invalid proof" means the action EXISTS but our dummy proof is (obviously) rejected.
  const dummyPayload = {
    nullifier_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    merkle_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
    proof: '0x00',
    verification_level: 'orb',
    action: actionId,
    signal: 'test',
    responses: [] // Added for v4 validation
  };

  const endpoints = [
    { name: 'v2 (Legacy)', url: `https://developer.worldcoin.org/api/v2/verify/${config.WLD_APP_ID}` },
    { name: 'v4 (World ID 4.0)', url: `https://developer.world.org/api/v4/verify/${config.WLD_APP_ID}` }
  ];

  for (const endpoint of endpoints) {
    try {
      let res;
      if (endpoint.name === 'v4 (World ID 4.0)') {
        // Use a specific payload for v4 to bypass 'responses array is required' validation
        res = await fetch(endpoint.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: actionId, 
                signal: 'diagnostic-check',
                protocol_version: '3.0',
                allow_legacy_proofs: true,
                nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
                signature: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
                created_at: Math.floor(Date.now() / 1000),
                expires_at: Math.floor(Date.now() / 1000) + 600,
                responses: [{
                    nullifier: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    merkle_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    proof: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    identifier: 'orb'
                }]
            }),
        });
      } else {
        // Use the generic dummyPayload for other endpoints (e.g., v2)
        res = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dummyPayload),
        });
      }

      const data = await res.json() as any;
      
      if (res.status === 400 && data.code === 'invalid_action') {
        console.error(`   ❌ [${endpoint.name}] NOT FOUND: "${actionId}" is not registered for this App ID.`);
      } else if (res.status === 400 && (data.code === 'invalid_proof' || data.code === 'invalid_merkle_root' || data.code === 'invalid_nullifier' || data.detail?.includes('responses'))) {
        console.log(`   ✅ [${endpoint.name}] Action exists! (Endpoint recognized the action but rejected the dummy payload)`);
      } else if (res.ok) {
        console.log(`   ✅ [${endpoint.name}] Action exists and dummy proof was somehow accepted (unexpected but positive).`);
      } else {
        console.warn(`   ⚠️ [${endpoint.name}] Unexpected response (${res.status}):`, JSON.stringify(data));
      }
    } catch (err: any) {
      console.error(`   ❌ [${endpoint.name}] Connection failed: ${err.message}`);
    }
  }
}

async function run() {
  console.log('🚀 Starting World ID Configuration Diagnostic...');
  
  if (config.WLD_APP_ID.startsWith('app_staging_')) {
    console.log('ℹ️ Running in STAGING mode (Simulator)');
  }

  await checkAction(config.WLD_LOGIN_ACTION_ID);
  await checkAction(config.WLD_PAY_ACTION_ID);
  
  console.log('\n🏁 Diagnostic complete.\n');
}

run().catch(err => {
  console.error('Fatal error in diagnostic script:', err);
  process.exit(0); // Don't block startup even if diagnostic fails
});
