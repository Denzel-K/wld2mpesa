# WLD2Mpesa — Frontend

React + Vite Mini App for World App.

## Setup
```bash
npm install
cp ../.env.example .env.local
# Edit VITE_BACKEND_URL and VITE_WLD_APP_ID
npm run dev
```

## Environment Variables
| Var | Default | Description |
|-----|---------|-------------|
| `VITE_BACKEND_URL` | `/api` | Backend base URL |
| `VITE_WLD_APP_ID` | `app_staging_wld2mpesa` | World App ID |

## Pages
- `HomePage` — landing, rate display, CTA
- `PaymentFormPage` — KES amount + Till number entry
- `ConfirmationPage` — review breakdown + MiniKit pay()
- `ProcessingPage` — shown during World App native confirmation
- `StatusPage` — live polling step tracker
- `SuccessPage` — settled with M-Pesa receipt
- `FailurePage` — error with retry
