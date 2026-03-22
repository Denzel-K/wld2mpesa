# Daraja Integration: Kenyan Mobile Money Services

While Bitnob handles the bridge between Crypto and Fiat, the **Safaricom Daraja API** is used for advanced utility payments that require specific M-Pesa shortcode interactions.

## Support Services Matrix

| Service | Daraja Role | Bitnob Role |
| :--- | :--- | :--- |
| **Send Money** (P2P) | Direct B2C payout. | Primary payout mechanism. |
| **Buy Goods** (Till) | B2B payment request. | Secondary (Fallback). |
| **Paybill** | B2B with Account No. | Not directly supported. |
| **Lipa na Pochi** | B2B to Pochi. | Supported via phone no. |

## Integration Strategy

### 1. Paybill (The "Account Number" Leg)
For utility bills like KPLC or Nairobi Water, a specific **Account Number** is required.
-   **Flow**: WLD -> Bitnob -> Our Daraja Shortcode -> `BusinessPayBill` API.
-   **Automation**: The `mpesaService.ts` handles the final `BusinessPayBill` command using the user's provided account number.

### 2. Buy Goods & Services (Till)
Tills are common in supermarkets and small businesses.
-   **Flow**: WLD -> Bitnob (Direct Payout).
-   **Enhancement**: If Bitnob lacks a specific Till's metadata, we use Daraja's `CustomerBuyGoodsOnline` command.

### 3. Lipa na Pochi la Biashara
Often used by informal traders.
-   **Flow**: WLD -> Bitnob -> Pochi Phone Number.
-   **Benefit**: This is essentially a P2P transfer, which is Bitnob's fastest leg.

## Future Enhancements
-   **B2C Shortcode**: To handle bulk distributions in KES.
-   **Reconciliation Engine**: Matching Safaricom Receipt numbers with Bitnob Reference IDs in the `WebhookEvent` model.
