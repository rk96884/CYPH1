# PAY-01 — Mollie production payment readiness audit

**14 October 2026 — repository/record review only; NO live payment, no production configuration change, no GO-01 approval.**

This is a narrow review of PAY-01 in [COMMERCE-LAUNCH-READINESS.md](COMMERCE-LAUNCH-READINESS.md). It reuses the completed September/October staging evidence rather than proposing another round of synthetic checkout/refund exercises. It does **not** independently inspect Mollie account settings, Render environment variables or financial settlements.

## Existing evidence (do not repeat by default)

| Control | Evidence | Status |
| --- | --- | --- |
| Payment adapter and quote integration | `apps/commerce-api/src/config.ts` supports `disabled`, `mollie-test`, `mollie-live`; checkout gates require commerce enabled and selected provider. UK staged 1–3 quotes produced server-authoritative totals. | CODE PREPARED |
| Hosted Mollie test payments | 10 October hosted staging: 3-unit tracked home (£10.99 with £1 synthetic unit price) and 3-unit InPost (£6.99) marked paid and reflected in operations, without dispatch. | TEST EVIDENCE RECORDED |
| Webhook/idempotency | Existing webhook continuity/replay, duplicate and stale event handling documented in launch register and customer runtime plan. | STAGING/ENGINEERING EVIDENCE RECORDED |
| Refund/uncertainty | September completed partial and full-after-partial refunds, duplicate-webhook convergence, timeout/uncertain-provider safeguards. | STAGING/ENGINEERING EVIDENCE RECORDED |
| Reconciliation | September protected reconciliation CSV, exception handling and retrospective matching exercises. | ENGINEERING EVIDENCE RECORDED |
| Production baseline | Owner verified on 14 October that `COMMERCE_ENABLED=false`, `CHECKOUT_HTTP_ENABLED=false`, `PAYMENT_WEBHOOKS_ENABLED=false`, `PAYMENT_PROVIDER=disabled`, `FULFILMENT_MODE=disabled`, `FULFILMENT_PROVIDER=disabled` on the relevant production service. | OWNER-REPORTED; DO NOT CHANGE |
| Production shipping | Owner's 14 October read-only inspection: GB + 31 destinations, all disabled; 35 disabled rates; USA excluded. | DB SNAPSHOT; NOT LAUNCH-ELIGIBLE |

## Account-level confirmation — 14 October 2026

The project owner confirms that the **CYPH1 LTD Mollie live merchant profile is approved**, the **desired live payment methods are approved/available**, and the **settlement bank account has been approved**. Record these as **OWNER-CONFIRMED** in the launch evidence, not independently inspected by this code audit. No bank identifiers, account numbers or API credentials are recorded. This closes the three account-status confirmation items; it does **not** mean that production payment routing, webhook handling or a live transaction has been activated or validated.

## Distinct remaining PAY-01 evidence before GO

1. **Merchant account:** merchant profile, payment method and settlement bank approvals are **owner-confirmed** as above. Restrict the remaining account checks to administrator/MFA access review and documented payout/capture rules; do not request the same approval confirmation again.
2. **Live credential and webhook provenance:** confirm that live credentials can be provisioned through restricted Render secret settings, sender/webhook endpoint authenticity and isolation from staging. Do **not** enter or activate credentials during this audit; do not expose a live webhook route or run a test transaction yet.
3. **Production runtime separation:** assess both customer and operations services, current flag values, worker/job routing, access grants and origin/DNS protections. No movement from `disabled` is implied by a merged PR.
4. **Financial policy:** reconcile planned £74.99 unit retail price, shipping charges, tax/VAT treatment, fees, capture/refund timings, refund permissions, chargebacks, bank payout schedule and ledger/reconciliation owner. Existing pricing discussion is sufficient baseline; only final sign-off is open.
5. **Consumer-facing readiness:** ensure approved returns/cancellation/warranty, product claims and K-803 safety/compliance evidence, support contact and email/order status flows are ready before any customer payment. Separate gates remain open, including exact-model optical/IPL-specific safety evidence.
6. **Controlled later validation:** after product, carrier, commercial and ops sign-off, use a separately authorised bounded legitimate live payment/capture, webhook, refund/reconciliation and containment plan with named operators. No synthetic production order, no unpaid -> paid manipulation, no unauthorised live payment, dispatch or email.

## Read-only next action

Record the 14 October account-status owner confirmation in the restricted launch control register. Next inspect **only** the remaining production controls and account access (administrators/MFA, settlement/payout rules, live credential separation, webhook provenance and finance sign-off) without activating payment routes, creating orders or sharing sensitive values.

## Conclusion

PAY-01 remains **BLOCKED / NOT APPROVED**. Technical engineering has substantial staging evidence. Account approval has been **owner-confirmed**. Remaining work is administrator/account control review, production credentials/controls assessment, financial and policy signoff and a future expressly authorised bounded live validation. This audit is **documentation only** and intentionally changes no code, DB, rate status, shipping destination, secret, runtime gate, payment, fulfilment or communication.
