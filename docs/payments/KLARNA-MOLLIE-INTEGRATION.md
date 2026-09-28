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

The implementation is currently centred on the Mollie test adapter and its tests. Production enablement must not be inferred solely from the presence of these contracts.

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

The intended physical-goods flow is:

1. CYPH/1 creates the Mollie checkout with Klarna selected and `captureMode: "manual"`.
2. Mollie/Klarna may move the payment into `authorised` rather than immediately captured/paid.
3. CYPH/1 records the provider payment state and, when returned by Mollie, `authorisedAt` and `captureBefore`.
4. Capture is initiated only through the payment-provider capture capability as part of the controlled fulfilment/release process.
5. The capture request is idempotent and carries an operator/process identity for auditability.
6. The provider capture ID and normalised capture status are returned for persistence/reconciliation.

The branch contains a test proving that a Mollie `captureBefore` value is surfaced by the adapter and that the capture endpoint is called with an idempotency key.

## Capture safety controls

The domain contract now carries both:

- the amount requested for capture; and
- the authoritative authorised amount/currency ceiling.

It also requires `operatorId`, so a human operator or controlled process responsible for releasing fulfilment/capture can be represented in the audit trail.

These fields are intended to prevent an adapter or caller from capturing more than was authorised, capturing in a different currency, or creating an unauditable capture action. Production readiness requires the concrete adapter and orchestration path to enforce these controls end-to-end and tests to prove the fail-closed behaviour.

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

At the time of this document, the branch should be treated as an implementation branch rather than evidence that Klarna is production-ready. The next engineering checks are to ensure that the authorised-amount ceiling is enforced by the concrete capture implementation, wire manual capture to the intended fulfilment transition, add capture-deadline monitoring/alerting, and verify the same behaviour against the live Mollie provider path without weakening existing payment safety controls.

## Relevant code

- `packages/commerce-core/src/payment-provider.ts`
- `apps/commerce-api/src/payments/mollie-test.ts`
- `apps/commerce-api/src/payments/klarna.test.ts`
- `apps/commerce-api/src/payments/mollie-live.ts`
- `apps/commerce-api/src/payments/factory.ts`
- `apps/commerce-api/src/payments/registry.ts`

## Change-control rule

Any material change to Klarna checkout requirements, capture semantics, customer data sent to Mollie, fulfilment gating, refund handling or production enablement should update this document in the same change set. Do not mark a safety gate complete merely because code exists; retain test or operational evidence for the relevant production behaviour.
