# PR #144 — Staging Hyperdrive probe preparation (REVIEW ONLY)

**No infrastructure or database operations authorised or performed by this PR.** No Worker or Hyperdrive deployment, migration, SQL execution, environment changes or real network access.

## Intent
Use the existing staging PostgreSQL, but keep all probe writes in an isolated `cyph1_hyperdrive_probe` schema. No existing orders, payments, communication, fulfilment, customer or inventory rows may be changed. The existing harness queries `cyph1_hyperdrive_probe_jobs` without a schema. The dedicated probe role's reviewed `search_path` targets the isolated `cyph1_hyperdrive_probe` schema containing that table; this must be validated under the actual restricted role before any live test.

## Prepared artifacts
- `prototypes/cloudflare-commerce-cron/sql/staging-probe-setup.sql`: **not executed**; operator-review DDL and restricted privileges.
- `prototypes/cloudflare-commerce-cron/sql/staging-probe-cleanup.sql`: **not executed**, staging-only.
- `prototypes/cloudflare-commerce-cron/src/staging-probe-runner.mjs`: bounded, injected-client runner without network or environment handling.
- `staging-probe.test.mjs`: mock-only safety tests added to CI.

## Mandatory checks before any staging action
1. **Verify actual staging DB name**; SQL currently uses the **illustrative** `cyph1_commerce_staging`, which must be corrected to the actual database name by an operator. Never guess connection details or run against `cyph1_commerce_production`. Do not paste credentials into GitHub or chat.
2. Confirm existing staging database backups and the least-privilege role has **no broader rights** via PUBLIC, inherited roles, default database privileges, or existing grants; restrict `CONNECT` and table grants to only the isolated probe context where feasible.
3. Review Postgres ownership, non-public networking, certificate validation, the potential Render external DB access path, Hyperdrive TLS and account free-tier quotas/costs. **Do not open network access to production to support this test.**
4. Prepare a dedicated role secret with the operator's secure store. No credentials in code, SQL files, PR comments or screenshots.
5. Verify the effective probe-role `search_path` resolves only the intended isolated test table; recheck the DDL and cleanup for the actual staging cluster before execution. Ensure the live Worker is **not** attached to actual payment, messaging or commerce events.
6. Ask for **separate explicit authorisation** before running even staging DDL, creating a Hyperdrive configuration or deploying a Worker. Show expected resource changes and cost controls.
7. Once approved, conduct two-client concurrent claims, rollback on error, CPU and query budget measurements and cancellation/recovery verification. Require `COMMERCE_CRON_ENABLED=false` for all deployed commerce code until a distinct launch sign-off.

A green PR proves mock control flow only; it does **not** prove actual Hyperdrive connectivity, SQL semantics or free-tier viability.
