# Payment-provider outage and ambiguous-payment handling

**Status:** Pre-production engineering baseline; sandbox exercise and production approval outstanding

**Scope:** Checkout creation, payment-status retrieval, verified webhooks and refunds

**Safety rule:** Never create a replacement payment or refund while the original provider request may have succeeded.

## Purpose

A browser error, timeout or missing redirect does not prove that Mollie rejected a
payment. The provider may have created or captured it after the connection was
lost. The safe response is to contain new work, preserve the original references
and reconcile the provider's authoritative state before retrying anything.

This runbook does not authorise live payments. Until launch approval it applies
only to the private synthetic fixture and Mollie test mode.

## Existing system behaviour

| Situation | Application result | Required treatment |
| --- | --- | --- |
| Validation failure or definitive non-retryable provider rejection | Draft order is cancelled and checkout session is marked `failed` | Record the failure; a later deliberate attempt may use a new idempotency key |
| Timeout, network interruption, rate limit, provider `5xx` or retryable conflict | Order remains `draft`; checkout session becomes `resolution_required` with `ambiguous_provider_outcome` | Do not retry or fulfil; reconcile first |
| Payment webhook is repeated or stale | Durable provider event identity prevents a second state transition/outbox event | Retain the delivery evidence; no manual replay is normally required |
| Webhook cannot be verified because Mollie is unavailable | Delivery is retained with `verification_error`; the endpoint returns a retryable failure | Keep webhook exposure available and investigate provider recovery |
| Refund call has a retryable outcome | Refund becomes `resolution_required` and continues to reserve its amount | Do not submit a replacement refund until reconciled |
| Provider state conflicts with the permitted local transition or amount | Processing fails closed for manual review | Do not overwrite database state |

The original idempotency key cannot safely be repurposed for different request
content. A new key is not a way to bypass an ambiguous outcome.

## Signals and severity

Treat any captured payment without a matching local payment/order as urgent.
For staging, the project owner is the accountable incident owner.

| Level | Trigger | Initial response |
| --- | --- | --- |
| Isolated | One synthetic attempt is ambiguous and Mollie otherwise appears healthy | Stop that attempt and reconcile its references |
| Degraded | Repeated checkout/provider failures, delayed webhooks, or Mollie reports degradation | Disable new checkout; retain verified webhook processing |
| Critical | Suspected duplicate charge, captured payment without matching order, widespread state mismatch, or credential compromise | Disable checkout immediately and follow the incident/security escalation path |

Use the Mollie dashboard/status information, Render request events, protected
operations view and database-backed reconciliation as signals. A browser redirect,
customer statement or email is not authoritative payment evidence.

## Immediate containment

1. Record the UTC start time, environment, deployed commit and first safe
   correlation/request reference.
2. For a degraded or critical event, set `CHECKOUT_HTTP_ENABLED=false` and
   `COMMERCE_ENABLED=false` on the customer runtime, then restart/redeploy.
3. Keep `PAYMENT_WEBHOOKS_ENABLED=true` so authenticated notifications for
   in-flight payments can still be processed, unless webhook integrity or the
   payment credential itself is compromised.
4. Confirm `/checkout` no longer accepts new attempts while `/webhooks/mollie`
   remains routed. Do not suspend the whole customer runtime as the first
   checkout kill switch.
5. If the private checkout UI is deployed, disable its presentation flag and
   redeploy it after the server-side gates are closed.
6. Preserve logs and records. Never delete or directly rewrite orders, payments,
   refunds, sessions, webhook deliveries, events, outbox entries or audit events.

## Resolve an ambiguous checkout

1. Locate the `resolution_required` checkout session and its order using the
   protected operations/reconciliation surfaces. Retain only the order ID/order
   number, correlation ID, idempotency key and UTC timestamps in the incident
   record.
2. In the authorised Mollie test organisation, search using the original order
   reference and request window. Where provider support is required, supply the
   original idempotency and correlation evidence without disclosing credentials.
3. If Mollie reports a payment, record its provider payment ID and authoritative
   status. Allow the authenticated webhook/payment pipeline to reconcile it.
   Do not fulfil from the dashboard observation alone.
4. If the webhook is delayed, retrieve/replay it only through an approved
   provider or application mechanism. Do not manufacture webhook bodies or mark
   database rows paid manually.
5. If Mollie conclusively confirms that no payment was created, retain that
   evidence. The unresolved draft may then be closed through a reviewed
   application operation before a fresh checkout with a new idempotency key.
6. If the provider cannot prove whether a payment exists, leave the session in
   `resolution_required`, keep fulfilment blocked and escalate. Time passing is
   not proof of failure.

The current baseline deliberately has no operator command that force-resolves a
checkout session. Until such a command is implemented and audited, closing an
ambiguous draft requires an engineering-reviewed application change—not an ad
hoc SQL update.

## Resolve an ambiguous refund

1. Do not submit another refund. The unresolved amount remains reserved to
   prevent over-refunding.
2. Retrieve the original payment and refund state from Mollie using the provider
   payment ID, original refund idempotency key and request window.
3. If a refund exists, reconcile its provider ID, amount, currency and status
   through the approved operations/payment workflow.
4. If Mollie conclusively confirms no refund exists, record that evidence before
   a reviewed retry is issued.
5. Escalate any amount/currency mismatch, refund beyond the captured balance, or
   state transition that the application classifies as requiring review.

## Provider and webhook recovery

1. Confirm Mollie reports recovery and the configured credential remains a
   `test_` key in staging. Never reveal or log the key.
2. Confirm customer runtime `/health` and `/ready` return their exact healthy
   responses.
3. Confirm authenticated webhook deliveries are again verifiable and repeated
   notifications remain idempotent.
4. Reconcile every checkout, payment and refund created from 15 minutes before
   the incident through 15 minutes after recovery. Expand the window if clocks,
   provider status or logs are uncertain.
5. Confirm no `resolution_required` session/refund, unmatched captured payment,
   failed verification delivery or unsafe outbox event remains unexplained.
6. Re-enable checkout only after the incident owner records the reconciliation
   result and approves the change. Restore server-side gates before rebuilding
   any private presentation route.

## Privacy-safe evidence

Record:

- UTC start, containment, provider recovery, reconciliation and re-enable times;
- environment, source commit and incident owner role;
- provider status/support reference;
- application order/session/payment/refund identifiers and correlation IDs;
- counts by outcome, not customer identities;
- every resolution decision and the evidence supporting it;
- final gate values and health/readiness results.

Do not record API keys, access assertions, card/payment credentials, full names,
email addresses, postal addresses, raw webhook bodies or complete provider
payloads in GitHub, screenshots or the source-controlled evidence note.

## Required sandbox exercise

After a Mollie test account and reviewed `test_` key are available:

1. Complete one normal synthetic checkout and verified webhook transition.
2. Simulate a bounded provider timeout during checkout creation and confirm the
   session becomes `resolution_required` without a replacement payment.
3. Disable checkout while leaving webhook ingestion available; complete/replay
   the in-flight test notification and confirm idempotent reconciliation.
4. Simulate a retryable refund failure and confirm the amount stays reserved in
   `resolution_required`.
5. Reconcile all synthetic records, return every commerce gate to `false`, and
   record privacy-safe evidence in the launch-readiness register.

Follow `COMMERCE-DISABLE-AND-ROLLBACK.md` for containment and recovery and
`COMMERCE-INCIDENT-OWNERSHIP.md` for escalation ownership.
