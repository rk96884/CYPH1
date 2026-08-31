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

## Recovery verification

- `/health` returns `{ "status": "ok" }`.
- `/ready` returns `{ "status": "ready" }`.
- An approved read-only operator can retrieve the synthetic/empty order result.
- An unapproved identity is denied by Access.
- The direct Render origin rejects `/operations/*` without an assertion.
- Logs contain the expected request metadata and no prohibited data.

Production monitoring, on-call ownership, retention, escalation contacts and
numeric service objectives remain launch-gate decisions.
