# PR #140 — Cloudflare scheduled commerce processing feasibility

**14 October 2026 | Documentation-only analysis | PROPOSAL, NOT DEPLOYMENT OR PAYMENT/EMAIL ACTIVATION**

## Decision

**Conditional GO for an isolated non-production proof of concept; NO-GO for live deployment now.** Investigate a dedicated Cloudflare Worker with a five-minute Cron Trigger and Hyperdrive to existing paid Render PostgreSQL, avoiding a separately paid Render Background Worker **if** actual runtime and safety tests succeed. The $0 incremental-cost objective is **not yet proven** for this account; no Cloudflare usage, subscription, billing or connection has been changed.

## Existing CYPH/1 implementation assessed

| Existing component | Finding | Implication |
| --- | --- | --- |
| `apps/commerce-api/src/runtime/commerce-worker.ts` | Node `process.env`, signals, `pg.Pool`, endless polling via `runCommerceWorker` | **Cannot deploy unchanged** as a Cron handler. Replace process/polling lifecycle with bounded `scheduled()` event and explicit context bindings. |
| `communications/service.ts::TransactionalCommunicationConsumer.consumeOne()` | Processes a single claimed delivery with persisted send-start, manual-review for uncertain acceptance and semantic identity | Potential reuse **after** compatibility and interruption testing. Do not weaken idempotency or send-uncertainty fencing. |
| `communications/postgres.ts` | `BEGIN`/`COMMIT`, transaction-scoped `FOR UPDATE SKIP LOCKED`, durable leases | Test Hyperdrive connection-pooling transaction semantics and idle/statement timeouts. Disable read caching for claims and mutable state; no cross-invocation session assumptions. |
| `fulfilment/outbox.ts::runOnce()` | Claims one payment event, retries durably and calls existing fulfilment service | Potential reuse only after checking dependency bundling and `manual-live` semantics, deduplication, grants and audit. |
| `communications/brevo.ts` | Fixed Brevo API, bounded timeout, send-ID safety | Potential portability; **do not send** in initial feasibility tests. |
| Existing worker defaults | `COMMERCE_WORKER_ENABLED=false` exits before connecting to DB | Cron must preserve an **explicit disabled-by-default gate**, with no DB/HTTP side effects on a disabled tick. |

## External platform feasibility (Cloudflare documentation reviewed 14 October 2026)

- Cloudflare Workers Free includes Cron Triggers (up to **5/account**), **100,000 requests/day** and **10 ms CPU per invocation**. A scheduled trigger counts towards platform allowances; waiting for remote I/O does not automatically count as CPU, but database work, JSON/template rendering and bundling might exceed this very small limit. Confirm billed CPU and cron behaviour in a non-production invocation. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- Hyperdrive supports Postgres and is available under Workers Free at **100,000 database queries/day**; use only within shared account limits. [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).
- Cloudflare recommends the `pg` driver for Hyperdrive; current project uses **pg ^8.23.1**, above the current **8.16.3** documented minimum. This suggests potential driver compatibility, **not validated deployment compatibility**. [Connect to PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/).
- Hyperdrive needs an approved path to the **existing Render PostgreSQL**. Public-address reachability, Render access/network policy, credential separation, TLS certificate validation, Hyperdrive connection settings, and transaction pooling are **unverified**. Do not expose the database publicly, alter trusted sources or copy its secret merely to make the prototype work. [Hyperdrive setup](https://developers.cloudflare.com/hyperdrive/get-started/).
- Cloudflare Workers may require a compatibility date, Node.js-compatible APIs, and a bundle within plan limits. Existing Node server entry, process signals and resource pooling cannot be assumed portable. Free limit exhaustion can cause an invocation failure rather than silently making the workflow reliable.

## PoC success criteria — non-production, explicit separate approval

1. **No-send baseline:** a self-contained scheduled module, flag **off** by default, has zero DB connections and zero external Brevo calls, and no public HTTP mutation endpoint. Unit tests verify this.
2. **Dependency/bundle check:** compile and bundle `pg` and the minimum relevant consumers for Cloudflare with compatible platform flags; measure actual bundle size and CPU, no test shortcuts in production.
3. **Database isolation:** use a disposable/test PostgreSQL instance and separately approved Hyperdrive credentials; never bind `cyph1_commerce_production` for proof-of-concept. Confirm TLS, transaction-local locking, `SKIP LOCKED`, safe connection creation/closure, and no stale read caching.
4. **Bounded scheduler:** one trigger per 5 minutes; process at most a small fixed batch with per-run time budget, no infinite polling, and no overlapping sends beyond existing durable claims/leases. Prove no starvation or indefinite retention when rate limits/failures occur.
5. **Fault evidence:** simulated duplicate triggers, interruptions before/after provider acceptance, duplicate refund/payment events, expired leases and DB connection loss preserve existing `manual_review`, auditability and deduplication semantics.
6. **No real provider calls until separately authorised:** use an injected fake Brevo provider and synthetic test events. Measure CPU/resource consumption, trigger count and Hyperdrive query count on the actual account's available quota.
7. **Operator monitoring:** identify failure alerting, backlog/terminal review, compensation/recovery if a scheduled tick is missed, and the named owner/deputy. Free-plan capacity must account for the already deployed CYPH/1 signup Worker and other account usage.
8. **Promotion decision:** only after success and independent security/ops review propose a separate implementation PR and future explicit production deployment signoff. Preserve all disabled checkout, webhook, commerce, fulfilment, communication and shipping gates.

## What is not proved

- A free Worker can process the current Node stack within **10 ms CPU**.
- Render PostgreSQL network policy and Hyperdrive connectivity/security can be configured at no extra fee or without unwanted exposure.
- A five-minute cron job will always deliver an email in five minutes; email delays can exceed one interval during errors/backlog/provider downtime.
- Production background processing, email sender capabilities, migration 0017 status or real Brevo receipt are verified.

## Commercial conclusion

**Preferred experiment:** Cloudflare Cron + Hyperdrive, with a strict $0 incremental-cost test objective and no Render worker created. **Fallback** if limits, connectivity or reliability fail: re-evaluate an explicitly funded durable worker or alternate design; do not weaken the database/send safeguards to fit Free limits.

This change records analysis only: **no worker code or Wrangler config, no Cloudflare project, no Cron Trigger, no Hyperdrive binding, no Render/DB changes, no secrets, no payment and no emails**.

References: [Production worker readiness](PRODUCTION-BACKGROUND-WORKER-READINESS.md), [Transactional communications](TRANSACTIONAL-COMMUNICATIONS.md), [EM-01 audit](PRODUCTION-TRANSACTIONAL-EMAIL-READINESS-AUDIT.md).
