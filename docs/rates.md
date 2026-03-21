# Live Rates (WLD/KES)

WLD2Mpesa provides real-time exchange rates for Worldcoin (WLD) to Kenyan Shillings (KES).

## Rate Calculation Logic

The conversion follows a two-step process to ensure accuracy and liquidity:

1. **WLD/USD**: Fetched directly from the **Kraken API**.
2. **USD/KES**: Derived from a stable benchmark or provider (Yellow Card/Kraken).
3. **Final Rate**: `WLD/KES = (WLD/USD) * (USD/KES)`.

## Implementation Details

### Rate Service (`rates.service.ts`)
The backend maintains a `RateService` that:
- Fetches the current ticker from Kraken: `https://api.kraken.com/0/public/Ticker?pair=WLDUSD`.
- Applies a configurable spread/buffer to protect against volatility during the transaction window.
- Caches the rate for **60 seconds** to minimize API calls and ensure price stability for the user during the checkout flow.

### Frontend Integration
The frontend polls the `/api/rates/wld-kes` endpoint every 30 seconds while the user is on the conversion screen to show the most up-to-date estimate.

## API Specification

### `GET /api/rates/wld-kes`
**Response**:
```json
{
  "pair": "WLD/KES",
  "rate": 245.50,
  "lastUpdated": "2026-03-21T20:46:34.381Z",
  "provider": "Kraken"
}
```

## Relevant Files
- [rates.service.ts](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/backend/src/services/rates.service.ts) - Core rate orchestration.
- [rates.routes.ts](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/backend/src/routes/rates.routes.ts) - API endpoint definition.
- [HomePage.tsx](file:///home/jarhead/Documents/coDocs/minikit/wld-app-mini-app/wld2mpesa/frontend/src/pages/HomePage.tsx) - Frontend rate display and polling.
