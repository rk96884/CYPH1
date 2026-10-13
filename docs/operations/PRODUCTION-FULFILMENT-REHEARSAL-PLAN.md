# Production fulfilment readiness and controlled rehearsal plan

**Prepared:** 13 October 2026  
**Status:** PLAN ONLY — NOT AUTHORIZED TO EXECUTE LIVE DISPATCH OR ACTIVATE PRODUCTION COMMERCE.

## Reference implementation and prior evidence

The owner used the **staging-only** protected test workflow at:
`https://cyph1-commerce-ui-staging.pages.dev/private-commerce/integration-test-fixture/`.

It has supplied staged Mollie-test checkout, UK home/InPost quantity 1–3 quotations, a three-device paid order for each delivery method, persisted order/packing records and dispatch protections. Full hosted manual carrier booking/actual handover and customer email sending were **not** established by those tests; reuse the recorded findings in [COMMERCE-LAUNCH-READINESS.md](COMMERCE-LAUNCH-READINESS.md), especially the 10 October multi-quantity staging verification. Do not repeat prior quote/payment tests unless an actual release change warrants it.

The integration fixture is not a production order source. Do **not** point it at `cyph1_commerce_production`, move/copy its synthetic orders across environments, use its seed in production, use Mollie test payments as real captured orders, or enable `PRIVATE_CHECKOUT_FIXTURE_ENABLED` on production. Any suggestion to generate a paid record directly in production or bypass payment/fulfilment state checks is forbidden.

## Verified production baseline

Owner confirmed on 13 October:
- Cloudflare Access-protected operations UI loads; Find an Order and Reconciliation are visible. Packing/dispatch actions are order-contextual and not visible without an eligible selected order.
- `OPERATIONS_ACCESS_GRANTS` grants `fulfilment:read` to the operator but **not** `fulfilment:dispatch`; absence of the latter is deliberate. Grants are email-to-permission arrays, resolved through the verified Cloudflare identity.
- Render operations environment has `FULFILMENT_MODE=disabled`, `FULFILMENT_PROVIDER=disabled`, `PAYMENT_PROVIDER=disabled`, `COMMERCE_ENABLED=false`. Keep these values unchanged for this planning stage.
- Customer and operations `/ready` checks passed after database password rotation.
- Production PostgreSQL has GB and UK zone, two methods and four quantity-aware rates, **all disabled**, and **zero packaging profiles**. See [PRODUCTION-UK-SHIPPING-SETUP.md](PRODUCTION-UK-SHIPPING-SETUP.md).
- Branded order confirmation email design was approved; customer order-status page and compact footer PRs were merged and green. Live transactional email and fulfilment worker activation have not been approved.

## Operational prerequisites and approval gate

Before *any* live-like production rehearsal, obtain written/date-stamped approval for the exact scenario, operator, date/time, maximum financial exposure, rollback/containment and permissible actions. Record independent review of:
1. K-803 product safety/legal compliance and SH-01/SH-02 shipping approvals, including final carrier contents eligibility, parcel/compensation risk acceptance, actual carrier service and customer policy wording.
2. Real accepted inventory, the one-unit replacement reserve, and an approved eligible product; actual packing/parcel service for the planned quantity.
3. Current production backups/restore capability, source commit/migrations, private operations access, audit retention, production incident owner/deputy and support escalation.
4. Exact operator grant: retain `fulfilment:read`; grant `fulfilment:dispatch` only to the named approved operator for a constrained dispatch window, with planned removal afterwards. Cloudflare Access by itself does not imply application permission.
5. Separately reviewed production runtime configuration for `manual-live`/`live`, live Mollie payment/webhook obligations, production worker/communications capability and reconciliation. A disabled service or missing real captured payment cannot be bypassed just to demonstrate the UI.

**Until these approvals are recorded: do not toggle any production gates, run dispatch mutations, create a live payment, create synthetic paid records, or send customer emails.** The current exercise may inspect UI, access grants, health/readiness and read-only shipping information only.

## Rehearsal sequence after separate approval

A. **Read-only dry run (now permissible):** sign in via Cloudflare Access; confirm production dashboard, operator identity, `fulfilment:read` grant, health/readiness and empty/no-eligible-order state. Verify lack of dispatch permission remains a safe denial. Capture evidence without recipient data in general notes.

B. **Controlled provider end-to-end test (later, distinct approval):** create a legitimate, explicitly authorised order through the reviewed production flow **only after** launch prerequisites. Observe verified captured payment and one accepted manual fulfilment. Use the approved real shipping service and confirm the correct order, quantities (1–3), destination, customer-approved InPost point where applicable, packing and carrier booking. Purchase a label; **do not** mark dispatched on label purchase alone. Obtain actual handover evidence; record the carrier/service, genuine tracking reference, supplied HTTPS tracking URL if any, and handover confirmation using `fulfilment:dispatch`. Confirm protected timeline, absence of duplicate shipment, order/payment reconciliation, and downstream event state. Never fabricate a shipment reference or trigger a refund solely to test the page.

C. **Customer communications and exceptions:** with separately authorised live Brevo worker/sender, verify order confirmation after authoritative `payment.paid` and dispatch notification after `fulfilment.dispatched`. Keep actual customer contact/delivery details in restricted evidence only. Rehearse missing tracking URL, unavailable point requiring customer authorisation, duplicate command, uncertain response, refund conflict and communications failure using staging/disposable data unless a specific live test is safely approved.

D. **Containment and sign-off:** verify no unintended orders/shipments/emails, reconcile payments and retained carrier evidence, return temporary operator grants and gates to the documented disabled baseline as appropriate, and record who approved and witnessed each step. Record blockers as NO-GO rather than proceeding through missing prerequisites.

## Acceptance evidence matrix

| Area | Existing evidence | Remaining production evidence |
| --- | --- | --- |
| Quantity/price rules | Hosted staging 1–3 quotes; quantity 4 rejected | Live activation separately authorised; no retest required now |
| Payment/order snapshots | Mollie test paid three-device home and InPost orders | Legitimate authorised production captured payment and persisted order |
| Shipping methods/rates | GB/UK production rows disabled; prices inspected | Physical carrier acceptance and separate rate activation approval |
| Packing | Protected packing flows tested in staging | Eligible live order packing, stock/parcel verification |
| Dispatch permission | `fulfilment:read` present; `fulfilment:dispatch` absent | Named/temporary positive and negative authorisation checks |
| Manual booking/handover | Manual InPost Send workflow implemented; no API required | Real point match, actual carrier booking/handover/tracking evidence |
| Email/page | Approved offline email; page/footer merged | Authorised transactional delivery and no-exposure status validation |
| Reconciliation/rollback | Production read-only CSV available | Full scenario reconciliation and post-window disabled-state proof |

Related: [FULFILMENT-ADAPTER-OPERATIONS.md](FULFILMENT-ADAPTER-OPERATIONS.md), [TRANSACTIONAL-COMMUNICATIONS.md](TRANSACTIONAL-COMMUNICATIONS.md), [COMMERCE-CUSTOMER-RUNTIME.md](COMMERCE-CUSTOMER-RUNTIME.md). This plan is not launch GO-01 approval.
