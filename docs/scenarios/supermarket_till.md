# Scenario: Paying a Supermarket Till Number

This scenario describes how a user pays for groceries at a supermarket using WLD directly from their World App.

## Detailed Flow

1.  **Checkout**: The user arrives at a checkout counter with a "Till Number" (e.g., `456789`).
2.  **App Input**: User opens the WLD2Mpesa Mini App, selects "Buy Goods," enters the Till Number and the KES amount.
3.  **Authentication**: Mini App prompts for World ID verification (human-check).
4.  **On-Chain Payment**: MiniKit executes the WLD transfer from the user's wallet to the platform.
5.  **Automated Off-ramp**:
    -   Backend detects the WLD transfer.
    -   Backend triggers **Bitnob** to send the equivalent KES to the supermarket's Till Number.
6.  **Confirmation**: The supermarket's Till system receives a standard M-Pesa confirmation. The Mini App shows "Payment Success."

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User as User (World App)
    participant Backend as WLD2Mpesa Backend
    participant WorldChain as World Chain
    participant Bitnob as Bitnob Bridge
    participant Safaricom as M-Pesa (Supermarket Till)

    User->>Backend: 1. Initiate "Buy Goods" (Till: 456789, KES 1000)
    Backend->>User: 2. Request WLD Payment (MiniKit)
    User->>WorldChain: 3. Approve WLD Transfer
    WorldChain-->>Backend: 4. Transfer Confirmed (via Listener)
    
    rect rgb(200, 230, 255)
        Note right of Backend: Automated Engine
        Backend->>Bitnob: 5. Trigger Payout (KES 1000)
        Bitnob->>Safaricom: 6. Send Money to Till 456789
    end

    Safaricom-->>Bitnob: 7. Success Receipt
    Bitnob-->>Backend: 8. Payout Successful
    Backend-->>User: 9. Show Success (Receipt: QWERT123)
```

## Tools & Services Relied Upon
-   **MiniKit**: For the bridge between World App and our UI.
-   **Bitnob**: For the B2B mobile money payout.
-   **Daraja (Fallback)**: If Bitnob's direct Till payout is unavailable, the backend uses Daraja to deliver the final KES.
