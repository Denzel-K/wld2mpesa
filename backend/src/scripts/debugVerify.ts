
import { keccak256 } from 'viem';
// @ts-ignore
import { signRequest } from '@worldcoin/idkit/signing';
import { config } from '../config';

const APP_ID = config.WLD_APP_ID;
const RP_ID = 'rp_c205808e8673f770'; // From user logs
const SIGNING_KEY = config.WLD_SIGNING_KEY;

const ACTION = 'wld2mpesa-login';
const SIGNAL = '0x985dfa45f165c346cb52e4f9b87ac4abc24eaf24';
const PROOF = '0x09c69d6c9de7609e4298efd3bcb18aba4c1142a24c53aa25c0281b91ae53a5d8270d9c8ae925406d7966dd44bc846a2b291b38c73b030577d0215e2d07b1e71381814c5c5905b1b5305018a3037d36a99d442fb8612eb546301c5a576478c3775f2f6b87a48f7f53c98682e4534bebbef6c22d28899a9182acfb6719aaf382f40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const MERKLE_ROOT = '0x115458194f737d82c3a33d25d66ad750c95b658773116baba32ccf6c9ab33fea';
const NULLIFIER_HASH = '0x23be840c9310bb9aadf05e83d63206e3e70b11824db366a9696011f63e0fb7fc';

async function test(name: string, payload: any, urlOverride?: string) {
    console.log(`\n--- Testing: ${name} ---`);
    const url = urlOverride || `https://developer.world.org/api/v4/verify/${RP_ID}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error:`, e);
    }
}

async function runTests() {
    console.log(`Starting debug tests with RP ID: ${RP_ID}`);
    
    // Generate official signature
    const result = await signRequest(ACTION, SIGNING_KEY);
    const context = {
        rp_id: RP_ID,
        nonce: result.nonce,
        signature: result.sig,
        created_at: result.createdAt,
        expires_at: result.expiresAt
    };

    // 1. Official V4 Signature + Raw Signal
    await test("1. Official V4 Signature + Raw Signal", {
        action: ACTION,
        signal: SIGNAL,
        protocol_version: "3.0",
        allow_legacy_proofs: true,
        ...context,
        responses: [{
            nullifier: NULLIFIER_HASH,
            identifier: "orb",
            merkle_root: MERKLE_ROOT,
            proof: PROOF
        }]
    });

    // 2. Official V4 Signature + Hashed Signal (BigInt style - how MiniKit/IDKit hashes signals)
    // IDKit uses keccak256 and then shifts/truncates for the field element
    const hashedSignal = keccak256(SIGNAL as `0x${string}`);

    await test("2. Official V4 Signature + Hashed Signal (Raw Keccak)", {
        action: ACTION,
        signal: hashedSignal,
        protocol_version: "3.0",
        allow_legacy_proofs: true,
        ...context,
        responses: [{
            nullifier: NULLIFIER_HASH,
            identifier: "orb",
            merkle_root: MERKLE_ROOT,
            proof: PROOF
        }]
    });

    // 3. V2 Baseline with same values
    await test("3. V2 Baseline check (Is proof valid on V2?)", {
        nullifier_hash: NULLIFIER_HASH,
        merkle_root: MERKLE_ROOT,
        proof: PROOF,
        verification_level: "orb",
        action: ACTION,
        signal: SIGNAL
    }, `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`);
}

runTests();
