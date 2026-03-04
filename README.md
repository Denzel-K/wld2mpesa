# WLD2Mpesa

Pay any M-Pesa Business Till number instantly using Worldcoin (WLD) — inside World App.

## What it does

Kenyan World App users can convert their WLD and send KES directly to any
merchant's M-Pesa Buy Goods (Till) shortcode in under 5 minutes, without
leaving the World App.

1. Enter a KES amount and the merchant's Till number
2. See the live WLD equivalent and a 0.5 % service fee
3. Confirm with your World App biometric or PIN
4. The merchant receives KES in their M-Pesa account

## Status

MVP running in **simulation mode** — no real money moves.
Every service layer is stubbed with a production-ready implementation waiting
behind a single `SIMULATION_MODE=false` switch.

## Documentation

| File | Purpose |
|------|---------|
| [setup-n-start.md](setup-n-start.md) | How to run the platform (Docker + native) |
| [TRANSITION_GUIDE.md](TRANSITION_GUIDE.md) | How to go live with real money |
| [backend/README.md](backend/README.md) | Backend service reference |
| [frontend/README.md](frontend/README.md) | Frontend app reference |
