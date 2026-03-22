# Wallet & Account Requirements

To ensure a fully automated and compliant WLD-to-M-Pesa pipeline, the platform utilizes a **4-Wallet/Account System**. This isolates risks and ensures clear reconciliation.

## 1. User Wallet (World App)
- **Controlled by**: The End-User.
- **Role**: Holds the user's WLD tokens.
- **Action**: User scans the MiniKit QR code and approves the transfer of WLD to the platform's Admin Wallet.

## 2. Platform Admin Wallet (World Chain)
- **Controlled by**: Platform Backend (`ADMIN_PRIVATE_KEY`).
- **Role**: The entry point for all on-chain payments.
- **Action**: Receives WLD from users. Periodically executes DEX swaps (Uniswap V3) to convert WLD to USDC for rebalancing and bridging.

## 3. Bitnob Business Account (USD/KES Ledger)
- **Controlled by**: Platform via API.
- **Role**: The "Liquidity Bridge."
- **Action**: Receives USDC/USDT from the Admin Wallet. It provides the immediate KES liquidity needed for the payout without waiting for on-chain block confirmations.

## 4. M-Pesa Daraja Shortcode (Settlement Wallet)
- **Controlled by**: Platform via Safaricom Daraja API.
- **Role**: The "Final Mile" delivery.
- **Action**: For complex transactions like **Paybill** or **Till Numbers**, Bitnob delivers KES into this shortcode balance, which then executes the final Lipa na M-Pesa command.

---

### Inventory Checklist
- [ ] **World ID Action IDs**: (Login & Payment).
- [ ] **EVM Private Key**: With WLD/ETH for gas on World Chain.
- [ ] **Bitnob API Key**: Verified for Payouts.
- [ ] **Daraja Credentials**: Consumer Key, Secret, and Passkey.
