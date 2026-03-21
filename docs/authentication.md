# World ID 4.0 & SIWE Authentication

WLD2Mpesa uses a multi-step authentication process combining **Sign-In with Ethereum (SIWE)** and **World ID 4.0** proof verification.

## Authentication Stages

### 1. Wallet Authentication (SIWE)
The user first authenticates their wallet address via MiniKit’s `walletAuth` command.
- **Frontend**: `VerificationPage.tsx` calls `authenticateWallet()` which triggers `MiniKit.commandsAsync.walletAuth`.
- **Backend**: `/api/nonce` generates a server-side nonce. `/api/user/complete-siwe` verifies the SIWE message and signature.

### 2. World ID Verification
After wallet authentication, the user must prove their personhood using World ID.
- **RP Context**: The frontend fetches a signed "Relaying Party Context" from `/api/idkit/rp-context`. This ensures the verification request is secure and tied to our `RP_ID`.
- **MiniKit Proof**: The frontend calls `MiniKit.commandsAsync.verify` with the `action_id`, `signal` (wallet address), and `rp_context`.
- **World App**: The World App generates a Zero-Knowledge Proof (ZKP) and returns a `v4Result` payload.

### 3. Backend Sync & Final Verification
The final step is to verify the ZKP on the backend and sync the user's status.
- **API**: `POST /api/user/sync`
- **Logic**:
    - **Signal Hashing**: World ID 4.0 requires a specific "Field Hash". We use `keccak256(signal) >> 8` (implemented via `@worldcoin/idkit-core/hashing`) to ensure the hash fits the SNARK scalar field.
    - **Verify URL**: `https://developer.world.org/api/v4/verify/:rp_id`
    - **Payload**: The backend reconstructs the proof into the `responses[]` format expected by the Worldcoin v4 API.

## Implementation Details

### Data Hashing (Critical)
To prevent `invalid_proof` errors, the `signal_hash` MUST be computed as follows:
```ts
import { hashToField } from '@worldcoin/idkit-core/hashing';
const signalHash = hashToField(walletAddress).digest; // keccak256(addr) >> 8
```

### Docker DNS (Linux Fix)
Alpine Linux containers often fail to resolve `developer.world.org` when using the host's DNS stub. This is solved in `backend/src/server.ts` by overriding the Node.js resolver:
```ts
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
```

## Relevant Files
- [VerificationPage.tsx](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/frontend/src/pages/VerificationPage.tsx) - Frontend flow orchestration.
- [user.routes.ts](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/backend/src/routes/user.routes.ts) - Backend verification logic.
- [idkit.routes.ts](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/backend/src/routes/idkit.routes.ts) - RP Context signing.
