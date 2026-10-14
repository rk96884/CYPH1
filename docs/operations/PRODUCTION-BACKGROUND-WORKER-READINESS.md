# Production background worker deployment readiness — PR #139

**14 October 2026 — preparation/documentation only. NO deployment, worker launch, email sending, fulfilment, database change or production activation.**

## Scope and repository verification

- Worker entry: `apps/commerce-api/src/runtime/commerce-worker.ts`; command from repo root: `npm run start:worker --workspace @cyph1/commerce-api`.
- Build first using `npm ci` and `npm run build:runtime --workspace @cyph1/commerce-api`, retaining the compiled runtime path declared by `apps/commerce-api/package.json`.
- One Render **Background Worker** is the intended service type (no HTTP port or public endpoint), colocated with the existing Frankfurt PostgreSQL deployment. **Owner reports no worker currently deployed**; not independently validated against their Render account.
- `COMMERCE_WORKER_ENABLED` defaults false. `commerce-worker.ts` **exits without database access when false**. Therefore a Render process configured with all gates off is *not a continuously running idle service*; do not misconstrue an exit/restart loop as healthy readiness. Leave worker service uncreated/paused until a separately approved deployment sequence and startup expectations are defined. Do not set an enabled consumer merely to keep it running.
- When enabled, worker rejects configurations with neither fulfilment nor communications consumer active, and forbids production `manual-test`. One worker runs independent fulfilment/communications loops, handles SIGTERM/SIGINT and omits sensitive error payloads from logs. This does not constitute hosted production validation.
- The existing runbook requires explicit verification/application of migration `0017_communication_send_safety.sql` before worker use; migration application is **never** automatic at startup. Confirm production schema/migration state in a separately approved read-only check; do not run migrations here.
- PostgreSQL uses a **private** `DATABASE_URL`, `DATABASE_SSL=true` with certificate verification; never put connection strings, API keys or personal information in GitHub or chat.

## Brevo configuration — owner screenshot, 14 October 2026

The provided Brevo **Senders, Domains & Dedicated IPs → Senders** screenshot establishes:

| Item | Evidence | Assessment |
| --- | --- | --- |
| Verified sender | `CYPH/1 <info@cyph1.co.uk>` displays **Verified** | **OWNER SCREENSHOT VERIFIED** |
| DKIM | `cyph1.co.uk` shows a green DKIM check | **OWNER SCREENSHOT VERIFIED** |
| DMARC | Brevo shows **DMARC is configured** with green check | **OWNER SCREENSHOT VERIFIED** |
| Provider banner | Brevo reports all sender domains compliant with its Google/Yahoo/Microsoft sender requirements | **BREVO UI CLAIM**, not independent DNS audit |
| Sending infrastructure | **Shared IP** shown | **OWNER SCREENSHOT VERIFIED** |
| SPF | Not separately shown in screenshot | **NOT INDEPENDENTLY VERIFIED** |
| From address | Intended `TRANSACTIONAL_FROM_ADDRESS=info@cyph1.co.uk`, `TRANSACTIONAL_FROM_NAME=CYPH/1` based on screenshot | **PROPOSED CONFIGURATION**, not a Render setting |
| Reply-To | Screenshot does not show `TRANSACTIONAL_REPLY_TO_ADDRESS` or monitored mailbox status | **NOT VERIFIED** |
| Transactional API permission / quota / real mail | Not evidenced by sender verification alone | **NOT VERIFIED** |

This is provider **sender/domain** evidence, not evidence that a commerce worker, Render Brevo API key, sending permission, live transactional messages, inbox receipt or bounce processing exists. Commerce sends **application-rendered templates via Brevo API**, separately from the existing Cloudflare signup integration.

## Configuration contract — document only, DO NOT APPLY

| Variable | Safe readiness expectation |
| --- | --- |
| `NODE_ENV` | `production` when any future live Brevo sending is approved |
| `COMMERCE_WORKER_ENABLED` | **false** until separate worker activation approval |
| `COMMUNICATIONS_ENABLED` | **false** until separate message-processing approval |
| `COMMUNICATION_PROVIDER` | **disabled** until explicit provider approval |
| `COMMUNICATIONS_LIVE_SEND_ENABLED` | **false** until separate authorisation |
| `BREVO_API_KEY` | Do not add or disclose now; a separately approved commerce-scoped Render secret will be required |
| `TRANSACTIONAL_FROM_ADDRESS` / `TRANSACTIONAL_FROM_NAME` | Proposed screenshot-backed sender above; to be authorised as commerce sender |
| `TRANSACTIONAL_REPLY_TO_ADDRESS` | Choose and verify a monitored mailbox independently |
| `DATABASE_URL` / `DATABASE_SSL` | Restricted private production connection and verified TLS; no connections in this audit |
| `FULFILMENT_MODE` / `FULFILMENT_PROVIDER` | **disabled/disabled**, not authorised for dispatch |

The **customer** and **operations** service commerce/payment/fulfilment flags remain independently disabled. This PR does not alter any service setting.

## Remaining EM-01 / worker deployment gates

1. Verify Render worker service absence/current inventory, feasible service tier/cost and safe paused/deferred deployment approach. Do not start an all-disabled worker and treat crash/restart as a functional failure.
2. Read-only schema confirmation (migration 0017 and applicable later migrations), backup/restore provisions, service isolation and private DB access before any enabled consumer.
3. Confirm approved commerce From/Reply-To, actual monitored replies, SPF alignment as applicable, Brevo transactional API permissions, quotas/rate limits and separate least-privilege credential custody.
4. Verify final email content/consumer policy, K-803 safety evidence and supported order/shipping data.
5. Separately authorise and schedule **bounded** genuine provider acceptance/inbox/bounce and recovery test only after relevant prerequisites; document operators, controlled recipients, monitoring, financial exposure and stop/rollback. Provider acceptance alone does not prove inbox delivery.
6. Named owner/deputy, terminal/manual-review alerts, restricted retention/processor approval and incident/reconciliation operations before EM-01/OPS-01 closure.

**GO/NO-GO: NOT APPROVED**. Neither merging this PR nor creating a Render service authorises `COMMERCE_WORKER_ENABLED=true`, Brevo, live Mollie, fulfilment, shipping activation, webhooks or customer messaging.

References: [Transactional communications](TRANSACTIONAL-COMMUNICATIONS.md), [Production transactional email readiness](PRODUCTION-TRANSACTIONAL-EMAIL-READINESS-AUDIT.md), [Commerce launch readiness](COMMERCE-LAUNCH-READINESS.md), [Fulfilment rehearsal](PRODUCTION-FULFILMENT-REHEARSAL-PLAN.md).
