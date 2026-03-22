# Compliance, Security & Roadmap

To succeed in the Kenyan market and receive Safaricom/Government approval, the platform must adhere to the **Virtual Asset Service Providers (VASP) Act, 2025**.

## Current State vs. Success Gaps

| Feature | Current State | Gap to Success |
| :--- | :--- | :--- |
| **On-ramping** | Manual (Admin Wallet). | Automated DEX bridging to Bitnob. |
| **Off-ramping** | Implementation Ready. | Production Bitnob KYC approval. |
| **Compliance** | Theoretical. | Registration under VASP Act 2025. |
| **Security** | API Key protection. | Hardware Security Module (HSM) for keys. |

## Kenyan Regulatory Compliance (VASP Act 2025)

To operate legally as a "Crypto-to-Mpesa" bridge, the following are required:
1.  **Capital Thresholds**: Maintaining a specific KES reserve in a commercial Kenyan bank (30% of customer funds).
2.  **Physical Presence**: Establishing a localized office for the entity.
3.  **Governance**: A board of at least 3 natural persons.
4.  **KYC/AML**: Integration with a service like **Identity (IPRS)** to verify user National ID numbers during onboarding.

## Security Best Practices
-   **Timed Sessions**: Auto-logout for the MiniKit session.
-   **Thresholding**: Manual approval for transactions exceeding KES 10,000 until trust is established.
-   **IT Audits**: Biannual audits by certified Kenyan IT auditors as per CBK guidelines.

## Roadmap to Approval
- [ ] **Phase 1**: Legal Entity Registration in Kenya.
- [ ] **Phase 2**: Application for VASP License (CMA/CBK).
- [ ] **Phase 3**: Safaricom Daraja "Go-Live" approval (requires proof of regulated business status).
- [ ] **Phase 4**: Scaling Liquidity with direct World Chain-to-Bitnob bridge partnership.
