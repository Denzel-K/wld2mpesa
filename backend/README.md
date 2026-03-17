# WLD2Mpesa — Backend

Express + TypeScript API. Orchestrates the WLD → KES → M-Pesa pipeline.

## Setup
```bash
npm install
cp ../.env.example .env
npm run dev       # development with hot reload
npm run build     # compile to dist/
npm start         # run compiled
npm run test:e2e  # simulate a full payment end-to-end
```

## Key files
| File | Purpose |
|------|---------|
| `src/config.ts` | App configuration (World App IDs + payment API keys) |
| `src/services/paymentService.ts` | Core orchestration |
| `src/services/rateService.ts` | WLD/KES rate fetch |
| `src/services/offrampService.ts` | Yellow Card off-ramp |
| `src/services/mpesaService.ts` | Daraja B2B disbursement |
| `src/services/worldChainListener.ts` | World Chain tx listener |
| `src/services/transactionStore.ts` | JSON file persistence |
