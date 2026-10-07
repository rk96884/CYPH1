# Transactional communications

**Status:** Brevo adapter and background-worker engineering implementation; live delivery disabled pending EM-01 / OPS-01 / QA-01 / GO-01 evidence.

Commerce order messages are independent of marketing consent, list membership,
early-access double opt-in and manual support case correspondence. The existing
Cloudflare signup Worker remains separate. Commerce never subscribes customers
to marketing. Application-rendered approved HTML/text templates remain authoritative;
Brevo-hosted templates are not used.

## Authoritative flow

- `payment.paid` → order confirmation (`order-confirmation:<order-id>`).
- `fulfilment.dispatched` → dispatch (`dispatch:<fulfilment-id>`).
- `payment.cancelled` / `fulfilment.cancelled` → cancellation (`cancellation:<order-id>`).
- `refund.completed` → refund (`refund:<refund-id>`).

The communication ledger subscribes independently of fulfilment's outbox status.
Unique semantic keys prevent webhook/event replays creating a second message.
Recipients come from the customer record; they are not copied into the ledger.
Order amounts/items/delivery are saved order snapshots, not preview fixture values.
Dispatch retains carrier/reference and renders only supplied HTTPS tracking URLs;
no URL is inferred, and absent/invalid URLs omit the tracking button.

## Provider and configuration

Brevo HTTP transactional sending uses the fixed HTTPS `/v3/smtp/email` endpoint.
No redirects, SMTP transport, marketing contacts API or provider-hosted template is
used. Requests include From, Reply-To, recipient, subject, HTML and text. The
10-second timeout is comfortably below the default 300-second claim lease. Provider
response reading is bounded; only a validated message reference is retained.
Errors/logs must not contain credentials, recipient addresses, rendered messages
or raw provider responses. A ledger `sent` status means provider acceptance, not
confirmed inbox delivery.

All configuration below is server-only:

| Variable | Default / required use |
| --- | --- |
| `COMMERCE_WORKER_ENABLED` | `false`; explicit runtime activation |
| `NODE_ENV` | `production` required for live Brevo; explicit `test` or `development` for no-send provider |
| `COMMUNICATIONS_ENABLED` | `false`; independent communication activation |
| `COMMUNICATION_PROVIDER` | `disabled`; `brevo` or explicit non-production `manual-test` |
| `COMMUNICATIONS_LIVE_SEND_ENABLED` | `false`; separate explicit Brevo approval |
| `BREVO_API_KEY` | Secret required for enabled Brevo |
| `TRANSACTIONAL_FROM_ADDRESS` | Required approved sender email |
| `TRANSACTIONAL_FROM_NAME` | Required approved sender name |
| `TRANSACTIONAL_REPLY_TO_ADDRESS` | Required monitored reply mailbox |
| `DATABASE_URL` | Private PostgreSQL connection secret |
| `DATABASE_SSL` | Must be `true` in production; certificate verification required |
| `FULFILMENT_MODE`, `FULFILMENT_PROVIDER` | Existing independent fulfilment configuration; disabled by default; live manual pair is `live` / `manual-live` |

Presence of an API key alone never enables sending. Production rejects the
no-send provider; no silent fallback is permitted. Do not use `PUBLIC_` names.
The Cloudflare Worker secret is not shared with Render: approve/configure a
separate least-privilege commerce credential in Render only after authorisation.
A disabled worker exits without database access or provider calls.

## Idempotency evidence and uncertainty

Brevo's current [idempotency guide](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
describes an `idempotencyKey` email header, duplicate rejection and a 30-minute
window. Its [2021 changelog](https://developers.brevo.com/changelog/2021/11/10)
describes 15 minutes. The [send reference](https://developers.brevo.com/reference/send-transac-email)
also illustrates an `Idempotency-Key` spelling. Reviewed 7 October 2026.
These documents do not establish indefinite exactly-once delivery for this
single-message integration. Account-specific behaviour remains to be verified.

The adapter supplies `headers.idempotencyKey` as a stable UUID-shaped digest of
`communication:<semantic-key>`. This is an additional safeguard, never the basis
for replaying uncertain sends across a finite or unverified provider window.
No real Brevo request has been made as part of implementation validation.

Before calling the provider, the worker durably records `send_started_at` under
its unique claim token. A crash after this marker (even just before the HTTP
request) conservatively requires review. A stale pre-send claim may be safely
reclaimed with a new token. Completion/failure writes require the current token;
late acceptance after lease expiry cannot mark the message sent. Expired started
sends move to `manual_review` and are never automatically reclaimed.

- HTTP 429: definite rate-limit rejection; bounded automatic retry.
- Other definite 4xx (excluding 408/409): terminal rejection; investigate configuration/input.
- 408/409, 5xx, unexpected status, network loss, timeout, malformed acceptance or
  missing reference: uncertain; manual review, no automatic resend.
- Acceptance followed by database persistence failure: uncertain; manual review.
  Retain the known provider/message reference when the review write succeeds.
- Unknown provider exceptions: uncertain after send started; never assumed safe to retry.

A valid provider response may be lost, and a conservative review may delay an
email that was never sent. This is the intentional residual availability tradeoff
for avoiding duplicate customer messages.

## Retry, terminal failure and reconciliation

Default three attempts, five-minute retry delay and 300-second lease remain.
Definite failures at the limit set `terminal_failure`; permanent rejections do so
immediately. The monitor includes these rows and `manual_review`, plus exhausted
legacy failures. It must not report green merely because an original error code
was retained instead of `retry_exhausted`.

The named operations owner/deputy must investigate through restricted access:
check ledger semantic identity, provider reference/time and Brevo transactional
activity before any resend. Record evidence, decision and operator in the
restricted incident record. Never reset a claim or delete a deduplication row
merely to force sending. There is no new public replay endpoint in this change.
Ambiguous records remain blocked until an approved reconciliation procedure is
executed; if acceptance cannot be ruled out, escalate rather than resend.
For a confirmed acceptance, retain the provider reference and restrict any ledger
correction to an authorised maintenance transaction that locks the review row,
checks its current status/semantic key and records the named operator and evidence
in `audit_events`. For a confirmed non-acceptance, require the same documented
authorisation before re-arming a retry with the original semantic identity.
Never re-arm on absence of inbox receipt alone. No self-service reconciliation
command is introduced; production owner approval of this maintenance procedure
and its access/evidence controls remains an OPS-01 requirement.

## One background worker

Build: `npm ci` then `npm run build:runtime --workspace @cyph1/commerce-api`.
Start: `npm run start:worker --workspace @cyph1/commerce-api`.

Prepare one Render background worker colocated with the existing Frankfurt
PostgreSQL deployment. Use the private database URL and verified TLS; do not
include SSL override query parameters in `DATABASE_URL`. No public port, cron,
queue broker, carrier API or extra per-consumer service is required.

Fulfilment and communications have independent loops and error isolation.
Polling starts at 250ms and backs off to at most five seconds when idle/failing.
SIGTERM/SIGINT stops new claims, interrupts idle waits and drains active work
before closing the pool. Database connection/query timeouts are bounded. Logs
contain only timestamp, consumer and allow-listed outcome, not error objects.

Apply/verify migration `0017_communication_send_safety.sql` through an authorised
release step before starting the new worker or updated monitor. Never apply
migrations at worker startup. Existing in-flight legacy communication claims
are quarantined for review because their send outcome is unknown.

## External evidence still required

Do not enable live sending or mark gates complete from this implementation.
Retain approved From/name/Reply-To ownership; Brevo sender/domain verification;
SPF/DKIM/DMARC alignment; provider permission/limits and idempotency evidence;
controlled receipt/bounce/blocked-recipient checks; final commercial/policy data;
provider acceptance/crash/recovery rehearsals; production monitoring and named
owner/deputy; processor/retention/privacy approval and deployment QA.

Existing production manual paid-order cancellation confirmation remains a
separate workstream. The cancellation consumer supports authoritative events;
it does not manufacture them or turn a refund into cancellation.
