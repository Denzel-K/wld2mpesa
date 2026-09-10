# WLD2Mpesa Fee Analysis & MVP Requirements

## Purpose

This document defines the pricing, settlement, accounting and operational controls required before WLD2Mpesa processes production value. It supersedes the earlier whole-transaction 5% / 3% / 2% tier model and its copied consumer P2P M-Pesa tariff.

The objective is that every completed transaction covers configured platform costs and retains a positive margin, while customers see a clear, rail-specific quote before approving WLD payment.

## Executive summary

| Area | Current implementation | Production requirement |
|---|---|---|
| Service fee | Progressive fixed-plus-variable fee in `pricingService.ts` | Keep calculation server-authoritative and version every quote |
| M-Pesa fee | Separate reserve by Send, Pochi, Till and Paybill | Verify each reserve against the contracted payout rail |
| Off-ramp / DEX / gas | Configured estimates recorded on a transaction | Reconcile actual debits and gas after settlement |
| Profit protection | Sustainability floor protects a KES 10 estimated margin | Block or re-quote when executable provider price exceeds reserve |
| Fee UI | Customer fees and platform reserves are separated | Use server quote for every final display |
| DEX / payout sequence | Payout blocks if DEX rebalancing fails | Use executable quote and record actual swap before payout |
| Refunds | Retry flow exists and post-payout refunds are blocked | Reconcile provider status before every refund |

`OFFRAMP_RESERVE_PERCENT=2.2` is a development reserve, not a confirmed Bitnob production price. Do not claim an actual provider fee or realised profit until a provider quote and settlement debit are recorded.

---

## 1. Progressive platform service fee

The service fee is a KES 10 fixed component plus progressive marginal bands. On crossing a threshold, a transaction keeps the rates earned in lower bands; it is never repriced downward.

| Portion of recipient amount | Marginal service fee |
|---|---:|
| Fixed component per transaction | KES 10 |
| First KES 1,000 | 5.00% |
| Next KES 4,000 | 4.00% |
| Next KES 15,000 | 3.50% |
| Amount above KES 20,000 | 3.25% |

```text
service fee = KES 10
            + 5.00% × min(A, 1,000)
            + 4.00% × min(max(A − 1,000, 0), 4,000)
            + 3.50% × min(max(A − 5,000, 0), 15,000)
            + 3.25% × max(A − 20,000, 0)
```

`A` is the exact KES amount the recipient receives. `backend/src/services/pricingService.ts` is authoritative. The mini-app and website are previews; the final amount must be sourced from `POST /api/payment/quote` before payment confirmation.

### Sustainability floor

Small transfers can otherwise fail to cover fixed gas and provider costs. The server calculates:

```text
floor = (off-ramp reserve + gas reserve + minimum margin
         + DEX rate × (recipient amount + M-Pesa rail reserve))
        / (1 − DEX rate)

charged service fee = max(progressive service fee, floor)
```

Development defaults are 2.2% off-ramp, 0.3% DEX, KES 10 gas and KES 10 minimum margin. If applied, the UI must call it **Minimum sustainable service fee**. It must not be presented as an M-Pesa network charge.

### Why progressive rather than cliff tiers

A whole-transaction schedule can reduce revenue at a threshold: for example, a KES 5,001 payment could earn less than KES 5,000 if the full amount switches to a lower percentage. Progressive marginal bands make total fee and estimated KES margin non-decreasing while allowing the marginal rate to ease as ticket size rises.

Fixed-plus-variable pricing is standard in money movement. Wise exposes fixed and variable partner fees; Stripe Global Payouts combines a fixed payout charge with a percentage; major exchanges use volume discounts without repricing previously traded value. [Wise Platform pricing](https://docs.wise.com/guides/product/send-money/quotes/pricing), [Stripe pricing](https://stripe.com/pricing), [Kraken trading fees](https://support.kraken.com/articles/201893638-how-trading-fees-work-on-kraken?mode=consumerapp), [Coinbase Advanced fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees).

### Till quote examples

The following use the development reserves above and the Till/Paybill reserve of 0.55% above KES 200, capped at KES 200. They are model outputs, not provider invoices.

| Recipient gets | Service fee | Till rail reserve | Customer total | Estimated platform margin |
|---:|---:|---:|---:|---:|
| KES 100 | 22.57 | 0.00 | 122.57 | 10.00 |
| KES 1,000 | 60.00 | 5.50 | 1,065.50 | 24.80 |
| KES 5,000 | 220.00 | 27.50 | 5,247.50 | 84.26 |
| KES 10,000 | 395.00 | 55.00 | 10,450.00 | 133.65 |
| KES 20,000 | 745.00 | 110.00 | 20,855.00 | 232.43 |
| KES 150,000 | 4,970.00 | 200.00 | 155,170.00 | 1,194.49 |

```text
estimated platform margin = service fee − off-ramp reserve − DEX reserve − gas reserve
```

The M-Pesa rail reserve is separately collected for the payout rail; it is not platform revenue.

---

## 2. M-Pesa rail policy

The platform must never use a consumer P2P Send Money tariff for every payment. The customer pays WLD to the platform; the platform or its off-ramp provider sends the M-Pesa payout. Price the actual final rail.

| Transaction type | Intended rail | Quote treatment | Current status |
|---|---|---|---|
| `send` | B2C/mobile-wallet payout | B2C business reserve: KES 0 through 100, KES 5 through 1,500, KES 9 through 5,000, KES 11 through 20,000, KES 13 above | Reserve implemented; verify provider route |
| `pochi` | Pochi/mobile-wallet payout | Same B2C reserve until contracted Pochi price is known | Reserve implemented; route verification required |
| `till` | Merchant Buy Goods | 0.55% merchant reserve above KES 200, cap KES 200 | Reserve implemented; direct Till delivery must be tested |
| `paybill` | Business Paybill | 0.55% merchant reserve above KES 200, cap KES 200 | Reserve implemented; direct Paybill route remains required |

Safaricom publishes separate B2C and merchant charges. B2C assigns the charge to the sending business; Buy Goods is normally free to the customer while merchant collection commission applies. [Safaricom B2C tariff](https://www.safaricom.co.ke/images/Downloads/mpesa-b2c-registered-users.pdf), [Safaricom Buy Goods tariff](https://www.safaricom.co.ke/images/Downloads/Buy-goods-guides.pdf).

Before production, obtain a provider quote for each type. If the provider cannot deliver the required Till or Paybill identifier, reject before WLD payment; never deliver an ordinary phone payout while claiming a Till or Paybill was paid.

---

## 3. Customer quote and internal costs

### Customer-visible quote

Show only the lines that change the WLD debit:

1. Recipient receives — exact KES amount.
2. Service fee — progressive fee or clearly labelled minimum sustainable service fee.
3. M-Pesa `[type]` rail fee — separate reserve/pass-through.
4. Total fees and total WLD to send.
5. WLD/KES rate, quote ID, source and expiry.

Do not label backend gas, DEX cost or off-ramp cost as a customer network charge if the service fee funds them. World App usually sponsors many verified-user gas transactions, but sponsorship is conditional. [World Mini App FAQ](https://docs.world.org/mini-apps/more/faq), [World network-fee notice](https://support.world.org/hc/en-us/articles/47299394485011-Why-do-I-see-a-network-fee-for-my-transactions).

### Internal costs

| Field | Meaning | Must be actualised after settlement? |
|---|---|---|
| `platform_fee_kes` | Charged service fee | Yes |
| `safaricom_fee_kes` | Customer rail reserve | Yes |
| `bitnob_fee_kes` | Off-ramp estimated/quoted/actual fee | Yes |
| `dex_fee_kes` | DEX estimated/actual fee | Yes |
| `gas_buffer_kes` | Budget at quote time | Yes — record actual ETH gas and KES value |
| `net_platform_revenue_kes` | Estimated or realised service-fee margin | Yes — keep estimate distinct from final P&L |

---

## 4. Accounting and traceability requirements

The existing `Transaction` row is a useful start but is not a sufficient production financial ledger. It lacks actual provider debits, DEX execution amounts, fee-pricing version and an immutable transaction-event history.

### Required before production

1. Add `PricingQuote`: quote ID, pricing version, rate source/value, expiry, all customer fees, reserves and expected margin.
2. Add append-only `TransactionEvent`: `QUOTED`, `WLD_CONFIRMED`, `DEX_SUBMITTED`, `DEX_CONFIRMED`, `PAYOUT_SUBMITTED`, `PAYOUT_CONFIRMED`, `PAYOUT_FAILED`, `REFUND_SUBMITTED`, `REFUND_CONFIRMED`, `REFUND_FAILED`. Store UTC time, source/actor, provider reference, idempotency key and redacted response.
3. Record actual WLD received, DEX input/output and receipt, gas used, ETH gas cost, provider quote/debit, M-Pesa charge, payout amount and realised margin.
4. Use idempotency keys for quote, payout and refund, derived from transaction ID plus operation type.
5. Preserve signed webhooks, deduplicate by provider event ID and link processing result to the transaction.
6. Expose internal reserves and margin only to authenticated operations/admin users.

```text
realised margin = service fee actually collected
                  − actual off-ramp debit
                  − actual DEX fee / price loss
                  − actual backend gas in KES
                  − unrecovered reversal/refund cost
```

Daily reconciliation must compare provider statements, DEX receipts, World Chain transactions and settled records. An unreconciled payment must go to an operations queue, not automatic retry or refund.

---

## 5. Settlement and refund controls

### Required state machine

```text
QUOTED → WLD_PENDING → WLD_CONFIRMED → DEX_SUBMITTED → DEX_CONFIRMED
       → PAYOUT_SUBMITTED → PAYOUT_CONFIRMED → SETTLED

Failure before PAYOUT_SUBMITTED → REFUND_SUBMITTED → REFUND_CONFIRMED
Failure at/after PAYOUT_SUBMITTED → PROVIDER_RECONCILIATION_REQUIRED
```

Each transition must be idempotent and backed by a receipt/event.

### Refund policy

- Refund WLD only where payout has not been submitted or confirmed.
- At or after `PAYOUT_SUBMITTED`, obtain provider status/reversal result before a refund; otherwise both the recipient and customer could be paid.
- A refund is complete only with a confirmed on-chain receipt stored as `refund_tx_hash`.
- A failed refund remains `REFUND_FAILED`, alerts operations and is retried safely. Never report a refund without a confirmed hash.
- Backend ETH is an operating reserve; do not add an opaque customer refund-gas fee.

### DEX and liquidity gate

World Chain fees contain L2 execution and L1 security components and vary; KES 10 is a planning reserve, not a protocol guarantee. [World Chain transaction fees](https://docs.world.org/world-chain/developers/fees).

Obtain a real DEX quote using token-correct decimals, derive `amountOutMinimum` from that quote and persist the swap receipt. Never initiate payout after swap failure unless a formally approved prefunded-liquidity policy records the inventory draw and follow-up reconciliation.

---

## 6. Configuration controls

Store all pricing values in environment configuration, version them with each quote and restrict changes to authorised operators.

| Variable | Development default | Meaning |
|---|---:|---|
| `SERVICE_FIXED_FEE_KES` | 10 | Fixed service component |
| `FEE_TIER_1_PERCENT` | 5.00 | First KES 1,000 marginal fee |
| `FEE_TIER_2_PERCENT` | 4.00 | Next KES 4,000 marginal fee |
| `FEE_TIER_3_PERCENT` | 3.50 | Next KES 15,000 marginal fee |
| `FEE_TIER_4_PERCENT` | 3.25 | Fee above KES 20,000 |
| `OFFRAMP_RESERVE_PERCENT` | 2.20 | Development reserve; replace with provider quote |
| `DEX_POOL_FEE_PERCENT` | 0.30 | Pool-fee reserve; not price-impact control |
| `GAS_BUFFER_KES` | 10 | Backend gas reserve |
| `MINIMUM_MARGIN_KES` | 10 | Minimum estimated margin |
| `MPESA_TILL_RESERVE_PERCENT` | 0.55 | Till reserve until contract quote |
| `MPESA_PAYBILL_RESERVE_PERCENT` | 0.55 | Paybill reserve until contract quote |
| `MPESA_MERCHANT_RESERVE_CAP_KES` | 200 | Merchant reserve cap |

New configuration applies only to new quotes. Existing unexpired quotes must honour their stored version or be explicitly invalidated and re-approved.

---

## 7. MVP acceptance tests and launch gates

### Pricing

- [ ] Test all rails at KES 10, 100, 1,000, 1,001, 5,000, 5,001, 20,000, 20,001 and the maximum permitted amount.
- [ ] Verify total = recipient amount + service fee + rail fee.
- [ ] Verify service fee and estimated margin never decrease at a band boundary.
- [ ] Verify margin is at least `MINIMUM_MARGIN_KES` using configured reserves.
- [ ] Verify the server quote, not browser arithmetic, is passed to MiniKit.
- [ ] Verify website and mini-app preview against server quote for the same rate/configuration.

### Settlement and refund

- [ ] Confirm WLD source and amount on World Chain before DEX or payout.
- [ ] Record DEX quote, decimals, `amountOutMinimum`, receipt and actual gas.
- [ ] Test Send, Pochi, Till and Paybill with real route metadata in sandbox and production approval.
- [ ] Prove duplicate webhooks, payout retries and refund requests cannot cause a second movement of value.
- [ ] Simulate failure before payout submission and confirm one on-chain WLD refund.
- [ ] Simulate uncertain provider status after payout submission and confirm automatic refund is blocked pending reconciliation.
- [ ] Reconcile one completed transaction from quote to WLD receipt, DEX receipt, provider debit and M-Pesa receipt.

### Launch gates

- [ ] Written production fee schedule or executable quote behaviour from each provider.
- [ ] Signed webhook verification and event-id deduplication enabled.
- [ ] Production DEX quote/execution test passed using correct decimals.
- [ ] Financial-event migration deployed, backed up and retention-tested.
- [ ] Operations dashboard separately shows quoted, estimated and realised margin.
- [ ] Refund wallet funded and an on-chain refund drill completed.
- [ ] Legal/compliance approval for the intended custody, conversion and payout flow.

## Sources and scope notes

- Safaricom sources establish the distinction between B2C and merchant rails; WLD2Mpesa must use the actual contracted/provider quote as its financial source of truth.
- Bitnob says fees vary by payment method and destination; its public material does not establish the 2.2% development reserve. [Bitnob Global Payouts](https://bitnob.com/en-US/products/payments/).
- Nekron's World listing confirms Kenya mobile-wallet and airtime functionality but does not publish a comparable fee schedule. [Nekron listing](https://world.org/ko-kr/ecosystem/app_d826abbcef7ac8a14db406b6d2f7562d).
