/**
 * verify-bitnob.ts — Bitnob API Verification Script
 *
 * Run this script to verify your Bitnob API credentials are working correctly.
 *
 * Usage:
 *   npx ts-node src/scripts/verify-bitnob.ts
 *
 * Or with tsx:
 *   npx tsx src/scripts/verify-bitnob.ts
 */

import { config } from '../config';
import { bitnobService } from '../services/bitnobService';

async function verifyBitnobConnection(): Promise<void> {
  console.log('🔍 Verifying Bitnob API Connection...\n');

  // Check environment variables
  console.log('1️⃣  Checking Environment Variables...');
  const checks = [
    { name: 'BITNOB_API_KEY', value: config.BITNOB_API_KEY },
    { name: 'BITNOB_CLIENT_ID', value: config.BITNOB_CLIENT_ID },
    { name: 'BITNOB_SECRET_KEY', value: config.BITNOB_SECRET_KEY },
    { name: 'BITNOB_ENV', value: config.BITNOB_ENV },
  ];

  let allPresent = true;
  for (const check of checks) {
    const status = check.value ? '✅' : '❌';
    console.log(`   ${status} ${check.name}: ${check.value ? 'Present' : 'MISSING'}`);
    if (!check.value) allPresent = false;
  }

  if (!allPresent) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Please set them in your .env file:\n');
    console.error('   BITNOB_API_KEY=your_bearer_token');
    console.error('   BITNOB_CLIENT_ID=your_client_id');
    console.error('   BITNOB_SECRET_KEY=your_secret_key');
    console.error('   BITNOB_ENV=sandbox\n');
    process.exit(1);
  }

  // Check API connectivity
  console.log('\n2️⃣  Testing API Connectivity...');
  const baseUrl = config.BITNOB_ENV === 'production'
    ? 'https://api.bitnob.co/api/v1'
    : 'https://sandboxapi.bitnob.co/api/v1';
  console.log(`   Base URL: ${baseUrl}`);

  try {
    // Test exchange rate fetch
    console.log('\n3️⃣  Testing Exchange Rate API...');
    const rate = await bitnobService.getExchangeRate('USD', 'KES');
    console.log(`   ✅ Exchange Rate: 1 USD = ${rate} KES`);

    // Test phone number validation
    console.log('\n4️⃣  Testing Phone Number Validation...');
    const phoneTests = [
      { phone: '+254712345678', expected: true },
      { phone: '0712345678', expected: true },
      { phone: '254712345678', expected: true },
      { phone: 'invalid', expected: false },
    ];

    for (const test of phoneTests) {
      const result = await bitnobService.validatePhoneNumber(test.phone, 'Kenya');
      const status = result.valid === test.expected ? '✅' : '❌';
      console.log(`   ${status} ${test.phone} → ${result.valid ? 'Valid' : 'Invalid'}${result.formattedNumber ? ` (${result.formattedNumber})` : ''}`);
    }

    // Test payout initialization (sandbox only with small amount)
    if (config.BITNOB_ENV === 'sandbox') {
      console.log('\n5️⃣  Testing Payout Initialization (Sandbox)...');
      console.log('   Creating test payout of 10 KES...');

      const testPayout = await bitnobService.initiatePayout(
        10, // 10 KES
        '254708374149', // Safaricom test number
        `TEST-${Date.now()}`,
        'test@wld2mpesa.app'
      );

      console.log(`   ✅ Payout Created!`);
      console.log(`      ID: ${testPayout.id}`);
      console.log(`      Status: ${testPayout.status}`);
      console.log(`      Amount: ${testPayout.amount} ${testPayout.currency}`);
      console.log(`      Reference: ${testPayout.reference}`);

      // Check payout status
      console.log('\n6️⃣  Testing Payout Status Check...');
      const status = await bitnobService.getPayoutStatus(testPayout.id);
      console.log(`   ✅ Status Retrieved: ${status.status}`);
    } else {
      console.log('\n5️⃣  ⏭️  Skipping payout test (production environment)');
    }

    console.log('\n✅ All checks passed! Bitnob API is configured correctly.\n');

  } catch (error) {
    console.error('\n❌ API Test Failed!\n');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);

      if (error.message.includes('401')) {
        console.error('\n   💡 Tip: Check your BITNOB_API_KEY is correct and not expired.');
      } else if (error.message.includes('403')) {
        console.error('\n   💡 Tip: Your account may not be verified. Complete KYC on Bitnob dashboard.');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('\n   💡 Tip: Check your internet connection and firewall settings.');
      }
    }
    console.error('');
    process.exit(1);
  }
}

// Run verification
verifyBitnobConnection().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
