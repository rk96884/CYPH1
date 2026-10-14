# Production Shipping Readiness Audit — PR #136

**14 October 2026 | READ-ONLY REVIEW | GO-01: BLOCKED / NO LAUNCH AUTHORITY**

Scope: reconcile the merged shipping/checkout code (#133–#135), the owner-provided 14 October read-only production shipping inspection, and the launch control register. This document is an **evidence map**, not a live production query or a certification of carrier, inventory, compliance, or fulfilment readiness. No operational actions are authorised by merging it.

## 1. Evidence and status

| Area | Evidence observed | Assessment |
| --- | --- | --- |
| Regions/exclusions | `packages/commerce-core/src/countries.ts`: six reporting groups; three tariff zones; US excluded via `isExcludedLaunchCountry` | **CODE VERIFIED**. Groups do not automatically approve destination eligibility. |
| Production shipping (owner-provided snapshot, 14 Oct 09:50:46Z) | 3 disabled zones; 32 disabled destinations (GB + 31); 2 disabled methods; 35 disabled GBP rates (four GB + 31 international); no US, no packaging profiles | **SNAPSHOT VERIFIED**, not independently re-queried by this PR. No live enablement. |
| GB tracked home charges | `checkout/service.ts` selects GB revision 1 399p for quantity 1, revision 2 799p for quantities 2–3 | **CODE PREPARED**, not physical/carrier approved. |
| GB manual InPost charges | Selects GB revision 1 259p for quantities 1–2, revision 2 399p for quantity 3; UK-only; retains validated collection-point and mobile requirements | **CODE PREPARED**, manual Send booking only. No API/picker or substitution authority. |
| International flat charges | 1499p Europe; 2599p other configured regions; one-unit quotes still need active destination, zone, method, rate and suitable product/inventory | **PREPARED/DISABLED**. International multiple-unit orders require approved tariff/packaging configuration; not covered by flat-rate readiness. |
| Checkout eligibility | `service.ts` requires `commerceEnabled` and matching configured payment provider; `quoteShipping` checks eligible rate/destination; `checkout/postgres.ts` loads enabled shipping state | **CODE GUARDS PRESENT**. CI does not prove production configuration or carrier acceptance. |
| Product stock | `checkout/postgres.ts` computes available quantity from `available_quantity - reserved_quantity - safety_stock`; launch plan is around 20 K-803, one reserved | **NOT VERIFIED IN PRODUCTION**. Never create placeholder stock or infer receipt. |
| Shipping packaging profiles | Zero rows in owner's 14 Oct snapshot; flat-rate rows do not require carrier-tariff packaging profiles | **NOT A DATABASE BLOCKER FOR FLAT RATES**, but physical fit/weight/contents/compensation evidence is missing. |
| Runtime activation | Owner confirmed production `COMMERCE_ENABLED=false`, `CHECKOUT_HTTP_ENABLED=false`, `PAYMENT_WEBHOOKS_ENABLED=false`, `PAYMENT_PROVIDER=disabled`, `FULFILMENT_MODE=disabled`, `FULFILMENT_PROVIDER=disabled` before setup | **OWNER-REPORTED BASELINE**, not inspected again by this PR. Keep off. |
| Backup | Owner confirmed 12 Oct Render backup available for restore | **AVAILABLE AS REPORTED**. Actual restore test not evidenced; this audit performs none. |

The pre-#135 findings in `PRODUCTION-INVENTORY-PACKAGING-AUDIT.md` about test-only UK InPost and UK home multi-unit are **superseded for code eligibility by PR #135**, not by a business approval. The older 13 October production snapshot in `PRODUCTION-UK-SHIPPING-SETUP.md` is historical, not the current international configuration.

## 2. Explicit blockers and evidence needed

| Gate | Blocker / next independent evidence | Status |
| --- | --- | --- |
| SH-01 — Royal Mail home | Measured **packed** single-, double-, triple-unit parcels; selected tracked service size/weight acceptance; confirmed prices and delivery wording | **OPEN** |
| SH-01 — compensation | Confirm actual service coverage and aggregate merchandise value for 1–3 units. At intended £74.99 each, values are £74.99, £149.98 and £224.97 respectively. Record owner acceptance of uncovered risk or approved protection, without assuming carrier terms. | **OPEN** |
| SH-01/SH-02 — InPost Send | Verify actual Medium/Large size/weight constraints, contents eligibility, compensation and declared-value treatment for 1–3 K-803 units; customer-selected point accuracy, manual purchase, tracking and handover process | **OPEN** |
| SH-01/SH-02 — international | For **each** candidate country separately, confirm service acceptance for mains-powered K-803, packed dimensions/weight, return logistics, customs/import conditions, compensation, duties/taxes and customer terms. Special handling for Turkey/Gulf/US and customs cannot be inferred from geography. USA remains excluded. | **OPEN** |
| Inventory/replacement reserve | Inspect product status, price, shipping weight, accepted stock and location-level `safety_stock` using a separately reviewed **read-only** inspection; confirm exactly one replacement reserve without double counting | **OPEN** |
| PT-01/CO-01 | K-803 exact-model test and UK safety/compliance documents, labels, instructions and claims reviewed by responsible competent person | **BLOCKED** |
| PAY-01/EM-01/OPS-01 | Production payments, verified webhooks, provider/refund/reconciliation, authorised tracking/handover, email readiness, support and operator grants | **OPEN/BLOCKED** |
| GO-01 | Dated accountable owner approval following all applicable gates, including rollback, monitoring and no unapproved status/flag changes | **BLOCKED** |

**No automatic activation follows a green CI result.** Individual country records do not become eligible until explicit later owner approval and reviewed configuration changes; activating a shared zone or method may affect several destinations and therefore demands a full impact assessment.

## 3. Operational read-only verification at a later approved time

1. Use the existing `node apps/commerce-api/scripts/inspect-production-shipping.mjs` with a securely configured operator-side production connection, **without any --apply flag**. It opens a read-only transaction. Never paste credentials or customer data.
2. Review exact country/status/rate counts and absence of USA; compare GB 259/399 and 399/799 pence values to the 14 October baseline. The inspector has a 500-row cap, so it cannot prove global absence of unexpected entries if the cap is reached.
3. Confirm current Render gates **read-only**, including operations service gates and grants; do not toggle values or grant `fulfilment:dispatch`.
4. Record physical/package/carrier/compliance evidence and an accountable gate owner in `COMMERCE-LAUNCH-READINESS.md`. Only after sign-off propose separately scoped changes to shipping statuses, inventory, checkout or payments.

## 4. Audit conclusion

**Code readiness is ahead of operational readiness.** The intended UK quantity pricing and disabled international destination catalogue align with the latest repository implementation and owner-provided database inspection. No production status change, order, payment, dispatch, email, migration, seed, or externally billable booking was performed. **SH-01/SH-02 and GO-01 remain open; production commerce remains NO-GO.**

References: [Production checkout readiness](PRODUCTION-CHECKOUT-READINESS.md), [International shipping preparation](PRODUCTION-INTERNATIONAL-SHIPPING-SETUP.md), [UK shipping preparation](PRODUCTION-UK-SHIPPING-SETUP.md), [Inventory/packaging audit](PRODUCTION-INVENTORY-PACKAGING-AUDIT.md), [Fulfilment rehearsal plan](PRODUCTION-FULFILMENT-REHEARSAL-PLAN.md), [Launch control register](COMMERCE-LAUNCH-READINESS.md).
