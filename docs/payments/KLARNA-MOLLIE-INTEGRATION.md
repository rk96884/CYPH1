# Klarna via Mollie integration

Status: implementation in progress on `feature/klarna-mollie-payments`

Last reviewed: 2026-09-28

## Purpose

This document records the CYPH/1 implementation for offering Klarna through the existing Mollie payment-provider boundary. It describes the behaviour represented by the branch at the date above and deliberately separates implemented controls from production-readiness work that still needs evidence.

## Architecture

CYPH/1 remains provider-oriented rather than embedding Klarna directly into the commerce domain. Klarna is selected as a payment method on the Mollie checkout request.

The core payment contract supports:

- `PaymentMethod = "klarna"`.
- `CaptureMode = "automatic" | "manual"`.
- customer/billing and shipping address data needed by payment methods.
- payment states including `authorised` and `captured`.
- provider `capture()` as an optional capability.
- `authorisedAt` and `captureBefore` on normalised payments.
- an authoritative authorised amount and an operator identity on capture requests.

The implementation includes the Mollie test adapter and protected operations capture orchestration. Production enablement must not be inferred solely from the presence of these contracts.

## Klarna checkout behaviour

For a checkout explicitly using Klarna, CYPH/1 requires manual capture. A Klarna checkout fails closed if `captureMode` is not `manual`.

The adapter also requires complete billing details before sending the request. The currently required fields are:

- email
- given name
- family name
- street and number
- postcode
- city
- country

When supplied, billing and shipping addresses are passed to Mollie. The checkout request also contains authoritative order lines, the order amount, CYPH/1 order metadata, callback URLs and the selected payment method.

Order-line validation remains authoritative on the CYPH/1 side: quantities must be positive, currencies must agree, each line total must equal unit price multiplied by quantity, and the aggregate line total must equal the authoritative order total.

## Manual capture lifecycle

The implemented physical-goods flow is:

**Klarna authorised → protected operator capture/release → Mollie capture confirmed → payment captured/order paid → existing fulfilment pipeline**

1. CYPH/1 creates the Mollie checkout with Klarna selected and `captureMode: "manual"`.
2. Mollie/Klarna may move the payment into `authorised` rather than immediately captured/paid.
3. CYPH/1 records the provider payment state and, when returned by Mollie, `authorisedAt` and `captureBefore`.
4. An authenticated operator explicitly granted `payments:capture` calls `POST /operations/orders/:orderId/capture`. This is the controlled release point; it does not itself dispatch goods.
5. The service reserves a durable `payment.capture` operator command transactionally before calling `PaymentProviderRegistry.getProvider(...).capture()`. Payment and order rows are locked and must represent one authorised payment for the full pending order amount/currency, without an already captured or unresolved payment.
6. Only a `completed` capture response matching the reserved provider, payment reference, amount and currency is accepted as confirmation. The repository uses the existing state transitions to persist payment `captured` and order `paid`, together with the `payment.paid` outbox event, in one transaction.
7. The existing fulfilment worker consumes that event. `PostgresFulfilmentRepository.reservePaidOrder()` still requires both order `paid` and a captured payment. Authorisation alone cannot start fulfilment.

### Endpoint and replay behaviour

Apply migration `0011_operator_capture.sql` before running this path. Add `payments:capture` only to the intended operator's server-side `OPERATIONS_ACCESS_GRANTS`; Cloudflare Access authentication remains required. Neither client-supplied permission headers nor `orders:read` grants confer capture authority.

The endpoint takes no amount or customer data. It captures the stored full authorised amount. `Idempotency-Key` is required: 1–128 ASCII letters/digits or `.`, `_`, `:`, `-`, starting with a letter or digit. The fingerprint binds the command type, order, operator and key. Reuse for another request returns `409`.

- Confirmed capture returns `200` with `status: "completed"` and the capture reference.
- A definitive provider rejection returns `502` with `status: "failed"`.
- Pending, retryable, unknown or mismatched outcomes return `202` with `status: "resolution_required"`; no fulfilment event is emitted by this command.
- Completed/failed/resolution-required commands replay their stored result without contacting the provider. A reserved command returns `409` and must not be resent.
- A unique per-order capture reservation also blocks replacement idempotency keys, including after failure. There is no automatic capture retry or command reset endpoint.

If the process stops after reservation, or persistence fails after the provider call, the command stays reserved. An operator must reconcile it with authoritative provider records; an HTTP failure is not evidence that capture failed. Likewise, pending and ambiguous outcomes require provider verification through the existing webhook/reconciliation process. Do not delete reservations or submit another capture to resolve uncertainty. Capture-deadline alerts and a dedicated operator resolution workflow remain separate work.

Reservation and outcome audit events record the operator ID, generated correlation ID, internal payment/order identity and normalised outcome/reference only. Raw provider responses, customer addresses, credentials and provider error messages are not persisted by this path.

The branch contains a test proving that a Mollie `captureBefore` value is surfaced by the adapter and that the capture endpoint is called with an idempotency key.

## Capture safety controls

The domain contract now carries both:

- the amount requested for capture; and
- the authoritative authorised amount/currency ceiling.

It also requires `operatorId`, so a human operator or controlled process responsible for releasing fulfilment/capture can be represented in the audit trail.

The operations path derives these fields from locked stored payment/order records; the Mollie adapter also checks the ceiling. The operations tests prove fail-closed behaviour for rejected states, replay, conflicting keys and uncertain outcomes. Production readiness still requires live-provider and operational evidence.

## Customer data and privacy

Klarna eligibility/risk processing requires more customer information than a basic payment flow. CYPH/1 therefore passes billing details and, where available/required, the shipping address through Mollie for the selected Klarna payment method.

Data minimisation remains the design rule: payment adapters should receive only the customer/address fields needed for the selected payment method and transaction. CYPH/1 remains authoritative for its own order and delivery records; Mollie/Klarna data must not silently become the source of truth for fulfilment.

Before production enablement, CYPH/1's customer-facing privacy information and internal processing records must accurately describe the payment data shared with Mollie/Klarna, the purpose of that processing, and the applicable retention/processor arrangements. This document does not itself establish legal compliance.

## Webhooks and reconciliation

Mollie webhook handling does not trust the inbound body as authoritative payment state. The adapter accepts the expected Mollie payment identifier form and retrieves the payment from Mollie's API before normalising the event.

Klarna-related Mollie states represented by the payment abstraction include:

- pending/open
- authorised
- captured/paid
- failed
- cancelled
- expired

Capture and payment state must remain reconciled with Mollie before fulfilment decisions are treated as final.

## Existing automated evidence

`apps/commerce-api/src/payments/klarna.test.ts` currently covers:

- sending `method: "klarna"`;
- sending `captureMode: "manual"`;
- sending billing and shipping addresses;
- rejecting incomplete billing details;
- rejecting automatic capture for Klarna;
- surfacing an `authorised` state and Mollie's `captureBefore` value;
- creating a capture through `/payments/{paymentId}/captures`; and
- supplying an idempotency key for capture.

The generic Mollie test adapter also validates authoritative checkout totals, callback origins, payment/refund state normalisation and provider error handling.

`apps/commerce-api/src/operations/capture.test.ts` exercises the protected handler, real operations repository and real fulfilment repository with a stateful SQL test double. It covers authorised capture, permissions, invalid/missing keys, invalid payment states, replay/conflict, in-flight and replacement attempts, provider failures, ambiguous results, persistence failure, audit minimisation and fulfilment gating before/after capture. These tests do not replace a PostgreSQL concurrency/deployment rehearsal. Both this file and the Klarna adapter tests run in `npm run test:commerce`.

The local PostgreSQL 17 rehearsal also passed on 2026-09-28 with all 11 migrations applied. It verifies concurrent same-key requests, concurrent replacement keys, committed reservation visibility before the provider call, ambiguous result replay, fulfilment before/after capture, and atomic rollback after a forced outbox persistence failure. Reproduce with `npm run db:rehearse:capture --workspace @cyph1/commerce-api` after migrating a disposable local database. Set `CAPTURE_TEST_DATABASE_URL` to that database; its name must end in `_capture_test`. The script uses a fake provider and leaves synthetic records in that disposable database. It does not contact Mollie or prove production readiness.

## Production safety gates

Klarna must remain disabled for real customer traffic until the following are explicitly verified and evidenced:

- Klarna is enabled and approved for the CYPH/1 Mollie account and intended UK sales model.
- The production Mollie adapter supports the required Klarna checkout fields and manual-capture lifecycle.
- Capture cannot exceed the authoritative authorised amount or use another currency.
- Capture is linked to the approved fulfilment/release point rather than checkout completion alone.
- Capture-deadline monitoring exists so authorised Klarna payments cannot silently pass `captureBefore`.
- Duplicate/retried capture attempts are idempotent.
- Webhook/reconciliation behaviour is tested for authorised, captured, failed, cancelled and expired states.
- Refund behaviour after capture is verified for Klarna transactions.
- Customer-visible checkout, cancellation, failure and return flows have been tested.
- Privacy/customer information and internal processing documentation reflect the Mollie/Klarna data flow.
- Production secrets and provider configuration are present only in the approved secret/configuration mechanism.
- A controlled production smoke test and rollback/disable procedure are documented before general availability.

## Remaining implementation work

The branch remains an implementation branch rather than evidence that Klarna is production-ready. Protected manual capture, fulfilment gating and a local PostgreSQL concurrency rehearsal are implemented. Remaining work includes deployment rehearsal, capture-deadline monitoring/alerting, a dedicated operator resolution workflow, and verification against the live Mollie provider path without weakening existing payment safety controls.

## Relevant code

- `packages/commerce-core/src/payment-provider.ts`
- `apps/commerce-api/src/payments/mollie-test.ts`
- `apps/commerce-api/src/payments/klarna.test.ts`
- `apps/commerce-api/src/payments/mollie-live.ts`
- `apps/commerce-api/src/payments/factory.ts`
- `apps/commerce-api/src/payments/registry.ts`
- `apps/commerce-api/src/operations/service.ts`
- `apps/commerce-api/src/operations/postgres.ts`
- `apps/commerce-api/src/operations/capture.test.ts`
- `apps/commerce-api/db/migrations/0011_operator_capture.sql`

## Change-control rule

Any material change to Klarna checkout requirements, capture semantics, customer data sent to Mollie, fulfilment gating, refund handling or production enablement should update this document in the same change set. Do not mark a safety gate complete merely because code exists; retain test or operational evidence for the relevant production behaviour.
