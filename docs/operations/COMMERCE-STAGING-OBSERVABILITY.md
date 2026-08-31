# Commerce staging observability and incident response

**Status:** Protected staging baseline; production commerce remains disabled  
**Scope:** Private commerce operations listener only

## Purpose

Detect failures at the protected staging boundary without recording customer
data, operator identities, Cloudflare assertions, credentials or request
payloads. This baseline supports engineering exercises; it is not a production
monitoring approval.

## Application logs

Every request handled by the operations listener emits one JSON line containing
only:

- UTC timestamp;
- severity and fixed event name;
- a server-generated request ID;
- HTTP method;
- a bounded route label: `health`, `readiness`, `operations` or `unknown`;
- response status, outcome class and rounded duration in milliseconds.

The same request ID is returned in the `X-Request-ID` response header. Use it to
match a browser failure to a Render log entry. Do not replace it with a
browser-supplied identifier.

The logger deliberately excludes full paths, query strings, request and
response bodies, headers, cookies, Access assertions, email addresses, IP
addresses, order references and raw exception messages. Application logs must
not be used as an order-history or audit-event store.

Example synthetic entry:

```json
{"timestamp":"2026-08-31T12:00:00.000Z","level":"info","event":"operations_http_request","requestId":"00000000-0000-4000-8000-000000000000","method":"GET","route":"health","status":200,"outcome":"success","durationMs":2}
```

## Monitoring setup

### Render

1. Keep the Web Service health-check path set to `/health`.
2. Enable owner notifications for failed deploys and service failures using the
   notification channels available on the account plan.
3. Confirm a successful deploy reaches `live` and detects the configured port.
4. Inspect `/ready` manually after deploys and database maintenance. A `503`
   indicates the process is alive but PostgreSQL is unavailable.
5. Retain logs only for the operationally necessary period supported by the
   plan. Do not export them to another processor without a privacy and access
   review.

### Cloudflare

1. Keep the exact staging hostname protected by the self-hosted Access
   application and its named-identity Allow policy.
2. Review Access login events after access changes and during incidents.
3. Treat unexpected denied-login volume or an allowed identity outside the
   approved operator list as a security signal.
4. Do not create a bypass policy for uptime monitoring. Render can monitor
   process health at its origin while Cloudflare continues to protect the
   operations hostname.

### Synthetic checks

- Render performs the continuous liveness check against `/health`.
- `.github/workflows/commerce-staging-monitor.yml` checks the direct Render
  origin's generic `/health` and `/ready` responses hourly and can also be run
  manually. It does not access `/operations/*` or bypass Cloudflare Access.
- Store the origin only as the GitHub Actions repository secret
  `COMMERCE_STAGING_ORIGIN`, using the HTTPS Render origin with no path or query.
  Do not use the Cloudflare-protected operations hostname for this secret.
- Ensure the accountable operator has GitHub Actions failure notifications
  enabled. A failed scheduled run is the staging alert; review the failed step
  before changing infrastructure.
- After a deploy or database change, an approved operator checks `/ready` and
  one read-only `/operations/orders` request through Cloudflare Access.
- The direct Render-origin `/operations/orders` request must continue to return
  `401 Authentication required` without an Access assertion.
- Synthetic checks must never create real orders, payments, refunds or customer
  records.

## Alert classification

| Severity | Trigger | Initial response |
| --- | --- | --- |
| Critical | Authentication boundary bypass, exposed assertion/secret, or suspected personal-data disclosure | Suspend the Render service or remove the Access Allow policy; begin the security incident process immediately. |
| High | Persistent `5xx`, `/ready` unavailable, database outage, or unexpected allowed Access identity | Disable affected operations, preserve identifiers and timestamps, and investigate Render, Cloudflare and database state. |
| Medium | Failed deployment, elevated `4xx`, repeated denied logins, or material latency increase | Review the latest deployment, Access policy and structured logs; escalate if persistent. |
| Low | Isolated expected denial, health-check transition during deployment, or one transient failure | Record and monitor for recurrence. |

No numeric production thresholds are approved yet. Establish them from staging
and controlled-launch measurements rather than inventing targets.

## Incident procedure

1. Record UTC start time, reporter, affected route label and `X-Request-ID`.
2. Do not paste assertions, credentials, personal data or full raw logs into an
   issue or chat.
3. Confirm whether `/health`, `/ready` and the protected read-only request fail
   independently.
4. Review the relevant Render deployment/runtime entry and Cloudflare Access
   audit decision.
5. If authentication or data exposure is suspected, fail closed by suspending
   the service or removing the Allow policy. Do not add bypass access.
6. For database failure, prevent mutations, restore connectivity, run schema
   verification and confirm readiness before restoring operator access.
7. For a bad deployment, roll back to the last reviewed version and repeat the
   protected and direct-origin verification checks.
8. Record cause, impact, remediation and follow-up owner without copying secret
   or personal values.

## Controlled staging incident drill

Run this exercise manually after the monitor secret and first successful
scheduled check are verified. Use synthetic data only.

1. Record the drill start time and notify the accountable staging operator.
2. Temporarily suspend the Render staging service. Do not alter Cloudflare
   Access, production configuration or database data.
3. Manually run **Commerce staging monitor** and confirm it fails on a generic
   endpoint without printing the configured origin or credentials.
4. Confirm the accountable operator receives or can see the failed Actions run.
5. Resume the same Render service and wait for it to report `live`.
   If resuming does not start the runtime, use Render's manual **Restart
   service** action, wait for the service to return to `live`, and record that
   intervention in the drill evidence.
6. Re-run the monitor and confirm both checks pass.
7. Verify one authenticated, read-only `/operations/orders` request through
   Cloudflare Access and confirm the direct origin still rejects
   `/operations/*` without an assertion.
8. Record the end time, detection result, recovery result and any follow-up.

Do not simulate an incident by deleting secrets, weakening Access, altering the
database or enabling payment/fulfilment configuration.

## Recovery verification

- `/health` returns `{ "status": "ok" }`.
- `/ready` returns `{ "status": "ready" }`.
- An approved read-only operator can retrieve the synthetic/empty order result.
- An unapproved identity is denied by Access.
- The direct Render origin rejects `/operations/*` without an assertion.
- Logs contain the expected request metadata and no prohibited data.

## Staging verification record

Verified on **31 August 2026** against the protected Render staging service:

- the operations runtime built and deployed successfully from `main`;
- Render reported the service as live on the configured staging hostname;
- expected Render root probes were classified as `unknown` and returned `404`;
- an authenticated `GET` request to the bounded `operations` route returned
  `200` with outcome `success`;
- the successful request emitted a server-generated request ID and a measured
  duration;
- the browser response included the matching `X-Request-ID` header; and
- the reviewed structured entry contained no personal data, request content,
  headers, query strings or credentials.

This confirms the protected staging request-correlation and privacy-minimised
logging baseline. It does not approve production commerce or define production
alert thresholds.

### Controlled monitor and recovery drill

Completed on **31 August 2026** using the Render staging service and synthetic
generic health checks only:

- workflow run **#1** established a successful healthy baseline;
- the Render staging service was suspended without changing Cloudflare Access,
  database data, payment configuration or production services;
- workflow runs **#2** and **#3** failed as expected while the service was
  unavailable, demonstrating visible outage detection;
- resuming the service required the operator to use Render's manual restart
  action before the runtime returned to `live`;
- workflow run **#4** succeeded after recovery, confirming that both generic
  liveness and database-readiness checks had recovered; and
- the exercise introduced no Access bypass and exposed no origin, credential,
  customer or payment data in the recorded evidence.

**Outcome:** staging failure detection and post-restart recovery verification
are proven. Render recovery should be treated as operator-assisted for this
environment until a later drill demonstrates reliable automatic recovery.

Production monitoring, on-call ownership, retention, escalation contacts and
numeric service objectives remain launch-gate decisions.
