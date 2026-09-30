# Klarna via Mollie integration

Status: capture reconciliation implemented; deployment and provider rehearsal pending

Last reviewed: 2026-09-30

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

**Klarna authorised → capture deadline monitored → protected operator capture/release → Mollie capture confirmed → payment captured/order paid → existing fulfilment pipeline**

1. CYPH/1 creates the Mollie checkout with Klarna selected and `captureMode: "manual"`.
2. Mollie/Klarna may move the payment into `authorised` rather than immediately captured/paid.
3. CYPH/1 records the provider payment state, capture mode and, when returned by Mollie, `authorisedAt` and `captureBefore`. The deadline monitor refreshes authorised payments and records actionable conditions.
4. An authenticated operator explicitly granted `payments:capture` calls `POST /operations/orders/:orderId/capture`. This is the controlled release point; it does not itself dispatch goods.
5. The service reserves a durable `payment.capture` operator command transactionally before contacting the provider. Payment and order rows are locked and must represent one authorised payment for the full pending order amount/currency, without an already captured or unresolved payment. A fresh `getPayment()` verifies identity, state, amount/currency and a valid future `captureBefore`; verified timing is persisted and audited. Missing, invalid, overdue or exactly-due deadlines fail closed to resolution-required handling without calling `capture()`. A stale local deadline is never used to decide whether capture is still possible.
6. Only a `completed` capture response matching the reserved provider, payment reference, amount and currency is accepted as confirmation. The repository uses the existing state transitions to persist payment `captured` and order `paid`, together with the `payment.paid` outbox event, in one transaction.
7. The existing fulfilment worker consumes that event. `PostgresFulfilmentRepository.reservePaidOrder()` still requires both order `paid` and a captured payment. Authorisation alone cannot start fulfilment.

### Endpoint and replay behaviour

Apply migrations through `0014_pending_capture_command.sql` before running this version (including `0011_operator_capture.sql`). Add `payments:capture` only to the intended operator's server-side `OPERATIONS_ACCESS_GRANTS`; Cloudflare Access authentication remains required. Neither client-supplied permission headers nor `orders:read` grants confer capture authority.

The endpoint takes no amount or customer data. It captures the stored full authorised amount. `Idempotency-Key` is required: 1–128 ASCII letters/digits or `.`, `_`, `:`, `-`, starting with a letter or digit. The fingerprint binds the command type, order, operator and key. Reuse for another request returns `409`.

- Confirmed capture returns `200` with `status: "completed"` and the capture reference.
- A definitive provider rejection returns `502` with `status: "failed"`.
- Verified provider-pending captures return `202` with `status: "pending"` and “Capture submitted — awaiting provider confirmation.” No paid/fulfilment event is emitted.
- Retryable, unknown or mismatched outcomes return `202` with `status: "resolution_required"`; no fulfilment event is emitted by this command.
- Pending/completed/failed/resolution-required commands replay their stored result without contacting the provider. A reserved command returns `409` and must not be resent.
- A unique per-order capture reservation also blocks replacement idempotency keys, including after failure. There is no automatic capture retry or command reset endpoint.

If the process stops after reservation, or persistence fails after the provider call, the command stays reserved. An operator must reconcile it with authoritative provider records; an HTTP failure is not evidence that capture failed. Pending captures await verified provider confirmation through the existing webhook/reconciliation process; ambiguous outcomes require manual resolution. Do not delete reservations or submit another capture to resolve uncertainty. Use the explicit reconciliation endpoint below.

Reservation and outcome audit events record the operator ID, generated correlation ID, internal payment/order identity and normalised outcome/reference only. Raw provider responses, customer addresses, credentials and provider error messages are not persisted by this path.

The branch contains a test proving that a Mollie `captureBefore` value is surfaced by the adapter and that the capture endpoint is called with an idempotency key.

## Explicit manual capture reconciliation

An unresolved capture must never be retried with a new provider idempotency key: a timeout does not establish that the provider rejected the previous request. Order Control hides ordinary Capture when any capture command exists and offers **Reconcile capture** for unresolved commands. A failed reload keeps capture controls disabled.

`POST /operations/orders/:orderId/capture/reconcile` uses the same Cloudflare Access authentication and `payments:capture` permission as capture. It accepts no amount, replacement key or override. The original stored command is the identity; a supplied client idempotency header cannot replace it. Missing commands return `404`; active attempts return `409`. This endpoint is an explicit operator action, never a scheduled retry.

1. Lock and claim the existing command, preserving its original operator, fingerprint, payment binding and key. A two-minute lease excludes concurrent recovery; completed results replay locally.
2. Through `PaymentProviderRegistry`, retrieve the current payment and complete capture list. Validate payment identity, full amount/currency and capture evidence. Incomplete, malformed, multiple or partial capture evidence remains manual resolution; no capture POST is sent.
3. A matching completed capture (with authorised/captured payment), or authoritative captured payment with an empty complete capture list, reconciles locally without a POST. Normalised capture ID/status/amount/creation time are stored in the command result. Provider `paidAt`, when supplied, supplies the order timestamp. Pending captures retain command status `pending`; failed captures remain manual resolution. Neither is ever replaced.
4. Authorised payment with no capture can resume only with the original stored request/key and original operator metadata, a future verified deadline, matching financial state/revision and provider replay evidence. The recovering operator and a fresh correlation ID are audited separately. There is no new command and no reset.
5. Failed/cancelled/expired provider payments reconcile through the existing payment state machine without capture. Other non-authorised or conflicting local states remain held for review. Provider lookup or replay errors remain resolution-required. Paid/order/outbox writes are atomic, and fulfilment still requires **order paid AND payment captured**.

### Mollie replay guarantee

[Mollie's idempotency documentation](https://docs.mollie.com/reference/api-idempotency), reviewed 2026-09-29, states that POST responses are cached for one hour and keys are credential-bound. Reusing a key after expiry can create a **new** request. CYPH/1 therefore allows replay for **less than 55 minutes** from the durable first-attempt timestamp, retaining five minutes of headroom. The adapter rechecks this immediately before sending. Negative/unknown age fails closed.

Migration `apps/commerce-api/db/migrations/0013_capture_command_reconciliation.sql` adds the immutable request, payment binding, first-attempt timestamp, replay-context digest and lease fields to `operator_commands`. The digest binds the credential, API base and capture wire-format version without storing the credential itself. Credential/endpoint/wire-format changes disable replay of earlier requests. The request stores internal identifiers, amount and original operator identity only, with no customer payload. Only allowlisted status/outcome information is exposed to Order Control; the original request, key, fingerprint and context digest are not exposed.

**Legacy commands lack reliable request/credential/attempt evidence.** Migration backfills only an unambiguous payment binding, never inferred replay evidence. An authorised legacy payment with no capture will therefore remain manual resolution, even if the dashboard shows Authorized. This includes the reported staging scenario if its command predates this migration. Existing provider captures can still be reconciled. Do not edit timestamps, fabricate evidence, delete commands or generate a replacement key to make the old fixture capture. Escalate to the payments owner for a separately reviewed provider/order resolution.

No environment variables or secrets are added. `CAPTURE_TEST_DATABASE_URL` is the existing local rehearsal guard only. No deployed migrations, scheduling, customer enablement or deployment are performed by this change.

### Validation after separately approved staging deployment

1. Keep the existing unresolved staging command untouched. Confirm the intended staging database and Mollie **test** credential. Pause operator capture during migration/runtime rollout; apply migration `0013` through the normal release mechanism and replace all old Operations instances before resuming. Keep customer enablement and fulfilment settings unchanged.
2. Sign in through Cloudflare Access as an operator granted `orders:read` and `payments:capture`. Open the affected order in Order Control. Verify provider reference, amount, currency, current Mollie payment status, capture list and `captureBefore`. Do not infer state solely from the earlier dashboard check.
3. Confirm ordinary Capture is hidden and **Reconcile capture** is available. Click once (equivalently POST the route above through the existing authenticated session, with no body or new key). Record HTTP status/outcome and the restricted audit correlation ID.
4. For the legacy staging fixture, expect `202` / `manual_resolution_required` when Mollie is still authorised with no capture. Verify **zero capture POSTs**, unchanged command key/fingerprint, unpaid order and blocked fulfilment. This refusal is the intended safe result, not a reason to reset the command.
5. If Mollie already has a matching completed capture, expect `200` / `capture_reconciled`, persisted capture details, payment captured and order paid. Repeat reconciliation and confirm the stored result returns without another provider request. Any actual fulfilment still follows its existing approved gates.
6. To prove safe resume, use a **separate approved synthetic test order created under this version**, in an isolated test harness with a controlled lost response and the same credential. Within 55 minutes, reconcile while the verified deadline is future. Confirm the wire request uses the exact original key/body once; outcome is `capture_resumed` or pending resolution. Never inject failures into the shared staging service or use the legacy fixture to fabricate this evidence.
7. Verify a read-only operator receives `403`, an unauthenticated request `401`, and a different ordinary capture key remains blocked. Confirm expired/ambiguous cases remain unpaid; inspect audits for the recovering operator without raw payloads/secrets.

Local evidence: `npm run test:commerce`, `npm run test:operations-capture-ui` and `npm run db:rehearse:capture-reconciliation --workspace @cyph1/commerce-api`. The PostgreSQL 17 rehearsal uses a migrated disposable local `*_capture_test` database and synthetic provider, covering concurrent claims, original-key replay, expired/legacy refusal, provider capture persistence, terminal state, revision fencing, atomic rollback, privacy and fulfilment gating. It does not contact Mollie or modify the real staging fixture.

## Provider-pending capture semantics (migration 0014)

A verified Mollie `pending` capture means the provider accepted the capture and has not confirmed completion. It is **not** evidence of payment, and is distinct from `resolution_required`, where the outcome is uncertain or cannot be verified.

| Provider outcome | Capture command / response | Payment and order |
| --- | --- | --- |
| `succeeded` | `completed`, HTTP 200; `capture.completed` audit | Existing domain transition to captured/paid and paid outbox event. |
| `pending` with verified identity, amount/currency, capture ID and timestamp | `pending`, HTTP 202; `capture.pending` audit | Payment remains authorised, order remains pending_payment; no fulfilment release. |
| `failed` | Existing `failed`, HTTP 502; `capture.failed` audit | No paid transition or fulfilment release. |
| Timeout, unknown status, malformed or mismatched response | `resolution_required`, HTTP 202 | Held for manual resolution; no paid transition. |

`apps/commerce-api/db/migrations/0014_pending_capture_command.sql` extends only the command-status constraint: `pending` is allowed only for `payment.capture`. It changes no existing rows, payment states, unique indexes or earlier migrations. The original request, operator, fingerprint, key, replay context and first-attempt timestamp remain intact. Normalised provider capture ID, status, amount and creation time are retained in the command result.

Repeated ordinary capture with the original key returns the stored result; a replacement key is still blocked. Reconcile reads the provider first. A matching pending capture returns `pending` / `capture_pending` and records `capture.reconciled` with that status. A matching completed capture advances the existing command/payment/order atomically. **Any known accepted capture ID permanently blocks provider replay**, even after a lookup fails or a later complete list unexpectedly omits it. These inconsistent reads become resolution-required while retaining the earlier capture evidence. Unknown/legacy commands without accepted-capture evidence retain the existing bounded original-key recovery rules.

The payment remains in the existing authorised state while pending, so the existing verified paid-webhook path can advance it to captured/paid. That path does not modify operator commands; a later reconciliation finalises the command without another capture POST. Webhook and reconciliation races do not regress captured payments or create a second paid event. Fulfilment still requires both order paid and payment captured.

Order Control hides ordinary Capture for every existing command, shows awaiting-provider-confirmation wording for pending, and permits explicit Reconcile. After an operation it reloads authoritative order details and updates both the timeline summary and matching search-result row from that response; a successful operation response alone never fabricates a paid display.

### Staging verification after separate approval

1. Apply migration `0014` before rolling out this Operations runtime/UI; pause operator capture during rollout and replace older instances before resuming. No new environment variables or secrets are needed. Do not edit migrations `0011`–`0013` or reset any existing command.
2. Use a separately approved synthetic staging payment. When Mollie returns pending, expect HTTP 202, command `pending`, `capture.pending` audit and awaiting-provider-confirmation wording. Confirm payment `authorised`, order `pending_payment` and blocked fulfilment and retained original request/key/evidence.
3. Repeat the same operation or load the order again: verify no second Mollie capture POST and no ordinary Capture control. Different keys must remain blocked. While provider capture remains pending, Reconcile must remain pending with no POST.
4. Once Mollie confirms completion, allow the existing verified webhook or explicitly Reconcile. Confirm payment captured/order paid, completed command after reconciliation, and both timeline and search row showing authoritative paid status. Verify no duplicate POST or paid event.
5. For genuine provider uncertainty retain manual resolution. A legacy command with insufficient replay evidence must still be held, not reset. No staging records, remote migrations or real captures are changed by local validation of this patch.

Automated evidence includes both test/live adapter pending/succeeded/failed/malformed cases, command replay and fulfilment gates, pending-to-pending/completed reconciliation, accepted-capture evidence surviving ambiguous/empty reads, authoritative UI refresh, PostgreSQL concurrent pending requests, paid-webhook convergence, schema constraints and existing capture/deadline/reconciliation rehearsals. All PostgreSQL rehearsals use local disposable data and synthetic providers.

## Capture safety controls

The domain contract now carries both:

- the amount requested for capture; and
- the authoritative authorised amount/currency ceiling.

It also requires `operatorId`, so a human operator or controlled process responsible for releasing fulfilment/capture can be represented in the audit trail.

The operations path derives these fields from locked stored payment/order records; the Mollie adapter also checks the ceiling. The operations tests prove fail-closed behaviour for rejected states, replay, conflicting keys and uncertain outcomes. Production readiness still requires live-provider and operational evidence.

## Capture deadline monitoring and alerting

Migration `apps/commerce-api/db/migrations/0012_capture_deadline_monitor.sql` adds capture mode, provider deadline/authorisation timestamps, current deadline condition, last-check time, a claim lease and payment revision. It does **not** backfill deadlines from elapsed days. Legacy unknown modes remain unknown until refreshed from Mollie; explicit manual capture requested at checkout is retained unless provider data supersedes it.

Provider checkout responses, verified authorised webhook events, monitor reconciliation and operator preflight persist timing. Timestamps must be valid ISO timestamps with an explicit time zone. Changed authorised deadlines have distinct webhook event identities so receipt deduplication does not suppress updates. Webhook bodies still supply only the identifier; state and timing are fetched from Mollie.

### Conditions and configuration

Windows are relative to authoritative `captureBefore`. Tests inject UTC time. Defaults are warning windows, not an assumed authorisation lifetime.

| Condition | Meaning |
| --- | --- |
| `safe` | Remaining time is greater than warning; no urgent outbox event. |
| `warning` | Remaining time is greater than critical and less than or equal to warning. |
| `critical` | Remaining time is positive and less than or equal to critical. |
| `overdue` | Current time is at or after `captureBefore`, including the exact boundary. |
| `missing_deadline` | A manual authorisation has no authoritative deadline; investigate without guessing. |
| `reconciliation_required` | Provider verification/identity/amount/state conflicted, or capture mode is unknown. |

| Server-only variable | Default | Validation |
| --- | --- | --- |
| `CAPTURE_DEADLINE_WARNING_MINUTES` | `1440` | Positive integer, maximum `525600`. |
| `CAPTURE_DEADLINE_CRITICAL_MINUTES` | `360` | Positive integer strictly less than warning. |
| `CAPTURE_DEADLINE_MAX_PAYMENTS` | `100` | Positive integer, maximum `10000`; limits reads per invocation. |

Invalid/blank configured thresholds stop the command before payment work. The operational owner must approve windows and cadence before production scheduling.

### Reconciliation and idempotency

The monitor claims authorised manual payments, also refreshing missing-deadline/unknown-mode legacy records. Known automatic and all non-authorised states (including captured, cancelled, failed, expired and resolution-required payments) are excluded. The monitor never calls `provider.capture()`.

Every claimed payment is refreshed through `PaymentProviderRegistry.getProvider(...).getPayment()`. Identity, amount/currency and timestamps are checked. A fresh provider extension supersedes a stale local deadline. Failed verification preserves payment state and raises a reconciliation condition. An overdue response leaves the order unpaid and payment authorised for investigation; the monitor does not guess that Mollie has expired/cancelled it.

Provider-confirmed capture uses existing payment/order transitions and atomically emits `payment.paid`; only that verified capture can release fulfilment. Provider-confirmed failed/cancelled/expired states stop warnings. The fulfilment repository is unchanged: it requires **both** order `paid` and payment `captured`.

Claims use `FOR UPDATE SKIP LOCKED` and a recoverable 60-second lease, one payment at a time. Provider I/O is outside the transaction. A database trigger advances the revision when payment state, financial identity or capture timing changes. A result is accepted only while its revision and claim token match. Concurrent webhook/capture changes or lease reassignment discard stale results. Interrupted claims are retried after lease expiry. Failed persistence rolls back refreshed state, alerts and audit together.

Each non-safe condition creates a `payment.capture_deadline.<condition>` outbox event and system audit event, uniquely keyed by payment ID, canonical deadline and condition. Warning → critical → overdue produces distinct events; repeated/concurrent runs do not duplicate the same event/audit. A changed authoritative deadline permits new alerts. Historical events remain after resolution. Any future delivery consumer must recheck current payment/condition rather than blindly sending old events. Existing fulfilment/customer-email workers filter their own event types and do not consume these operational alerts.

Events/audit contain payment/order IDs, provider/reference, payment state, deadline, condition, observation time and correlation/run ID. Fixed error codes replace provider error messages. No customer names, email, address, raw provider responses or credentials are included. Protected order details expose capture mode/timing, condition and last check; the existing timeline includes the payment audit events.

### Operational command — no schedule installed

Build the commerce runtime in the release artifact:

```sh
npm run build:runtime --workspace @cyph1/commerce-api
```

After separate deployment approval and migrations through `0012`, run in staging/production:

```sh
npm run monitor:capture-deadlines
```

Required server configuration: `DATABASE_URL` for the intended environment; `DATABASE_SSL=true` where TLS is required; `PAYMENT_PROVIDER=mollie-test` in staging or the approved `mollie-live` in production; that environment's `MOLLIE_API_KEY`; and approved `PAYMENT_CALLBACK_ORIGINS`. Use existing secret storage. Database TLS certificate verification stays enabled. Database access requires payment read/update, order update, outbox insert and audit insert. Running this command does not require or change customer checkout/fulfilment enablement.

Like the existing terminal-worker monitor, it emits privacy-safe JSON run/count summaries and an exit status for the scheduler's existing operational notification route:

- `0`: all eligible records checked, no actionable conditions.
- `1`: warning/critical/overdue/missing/unverified data, a revision conflict or incomplete coverage remains. This stays non-zero while unresolved, even when no new outbox event is created.
- `2`: configuration/database/command failure. Logs remain generic to avoid secret disclosure.

Run serially at a cadence comfortably inside the critical window. A suggested initial staging cadence is five minutes, subject to operational approval. Size the batch/job timeout for authorisation volume and provider latency; inspect `remaining`/`conflicts` and rerun or increase capacity if needed. Missing runs and non-zero exits must reach the existing operational notification route. Configure incident grouping/escalation to avoid notifying on every unchanged poll. **No schedule, workflow, deployment or notification subscription is created by this change.** Persisting alert events alone does not establish a working human notification route.

### Manual resolution

1. Identify the payment/order, provider reference, deadline, condition and run using protected details/timeline or restricted audit/outbox records.
2. Verify current state/deadline through authenticated provider lookup/reconciliation. Investigate missing data, API failures or stale leases; never invent or manually extend a deadline.
3. For warning/critical payments, confirm fulfilment readiness before invoking the protected `payments:capture` workflow. Its fresh preflight still requires an authorised payment and future deadline. Urgency does not authorise capture.
4. For overdue/missing/conflicting data, withhold capture/fulfilment. A verified extension must be reconciled before protected release. Verified expiry/cancellation/failure leaves the order non-paid for manual customer/order resolution. Verified capture may enter the existing paid/fulfilment pipeline.
5. Never clear a reserved/failed/resolution-required capture command or use another key to work around it. The monitor does not retry or reset capture commands. Non-authorised resolution records remain visible through protected operations rather than deadline polling.
6. Rerun the monitor to confirm active conditions clear, preserving audit/history. Use capture reconciliation for unresolved commands; production notification-route rehearsal remains outstanding.

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

The deadline unit suite (`capture-monitor.test.ts`) covers deterministic window boundaries, missing/invalid timestamps, threshold validation, provider-only verification, safe failures and zero capture calls. The protected-capture suite additionally checks overdue/exactly-due/missing deadlines cannot reach provider capture.

The PostgreSQL 17 deadline rehearsal passed with all 12 migrations applied. It covers safe/warning/critical/overdue, missing deadlines, terminal/automatic exclusion, repeated and concurrent runs, warning escalation, authorised → captured, stale deadline extensions, provider read failures, lease recovery, stale response rejection, atomic rollback, checkout/verified-webhook persistence and the unchanged fulfilment gate. Run `npm run db:rehearse:capture-deadlines --workspace @cyph1/commerce-api` with `CAPTURE_TEST_DATABASE_URL` pointing to a **freshly migrated empty local database** whose name ends in `_capture_test`. It uses deterministic time and a fake provider, leaves synthetic records there, and refuses production/remote targets. The original capture concurrency/rollback rehearsal also passes against migration `0012`. These are local automated checks, not a production provider/notification rehearsal.

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

The branch remains an implementation branch rather than evidence that Klarna is production-ready. Protected capture, provider deadline persistence, monitoring/alert events, fulfilment gating and local PostgreSQL rehearsals are implemented. Outstanding operational work: approved migration/deployment, scheduler cadence/capacity, missing-run detection and the existing human notification-route wiring/rehearsal. Live Mollie reconciliation verification and the other production gates above also remain. No customer enablement is authorised by this implementation.

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
- `apps/commerce-api/db/migrations/0012_capture_deadline_monitor.sql`
- `apps/commerce-api/src/payments/capture-deadline.ts`
- `apps/commerce-api/src/payments/capture-monitor.ts`
- `apps/commerce-api/src/payments/capture-monitor-postgres.ts`
- `apps/commerce-api/src/runtime/capture-deadline-monitor.ts`
- `apps/commerce-api/scripts/rehearse-capture-deadlines.mjs`

## Change-control rule

Any material change to Klarna checkout requirements, capture semantics, customer data sent to Mollie, fulfilment gating, refund handling or production enablement should update this document in the same change set. Do not mark a safety gate complete merely because code exists; retain test or operational evidence for the relevant production behaviour.
