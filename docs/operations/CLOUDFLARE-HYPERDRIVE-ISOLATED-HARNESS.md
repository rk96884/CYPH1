# PR #143 — Isolated PostgreSQL transaction harness

**Stage 1 only — NO Hyperdrive connection, no Cloudflare resource, no database access, no production change.**

This local-only harness demonstrates the **shape of** a transaction-based claim used by the planned Cloudflare Cron processing. Its `claimOne(client)` takes an **injected mock client** in tests. No client, connection string, database instance, Worker scheduled handler, network request, Hyperdrive binding or migration is created.

The disposable future table is `cyph1_hyperdrive_probe_jobs`, deliberately **not** any actual CYPH/1 commerce or communications table. The harness uses `BEGIN`, parameterized `SELECT ... FOR UPDATE SKIP LOCKED`, `UPDATE`, `COMMIT`, and rolls back on errors. CI tests verify the query sequence, empty queue and error paths. This does **not** prove real concurrency, PostgreSQL row locking, transactions over Hyperdrive, Workers CPU use, or network connectivity.

## Separate later approval: disposable non-production live probe

Only with explicit owner approval:
1. Select disposable non-production PostgreSQL, verify no production hostname/database and no customer/payment data.
2. Review dedicated least-privilege credentials, TLS, Hyperdrive network requirements and whether a free account can support it without billable additions.
3. Use a **separate review** for a real Cloudflare binding and Worker deployment. Do not reuse any production `DATABASE_URL`; do not alter existing commerce services.
4. Re-run with two concurrent claims, forced transaction error and interrupted leases; verify one claim per job, no side effects on actual commerce tables, safe connection cleanup.
5. Measure CPU usage under Workers Free limits, query counts, transaction safety and provider-free performance. Evaluate missed ticks and recovery before any further implementation.

**Still prohibited:** production connection, actual email sending, live payment, fulfilment/dispatch, production migration or switching on `COMMERCE_CRON_ENABLED`. PR #141's Cron stays disabled and undeployed.
