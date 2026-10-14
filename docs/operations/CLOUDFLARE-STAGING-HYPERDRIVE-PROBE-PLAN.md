# PR #145 — Verified development-database Hyperdrive setup (REVIEW ONLY)

**Important terminology:** Render has an existing `cyph1_commerce_development` database (PostgreSQL 17, Frankfurt). There is **no separate staging-named Postgres instance** in the connected Render workspace. This is the non-production testing candidate; **`cyph1_commerce_production` must never be used**.

Read-only Render inspection on 14 October 2026 established that `cyph1_hyperdrive_probe` schema and restricted role do not exist. The development database's external IP allowlist currently includes `0.0.0.0/0`. That means source-IP access is broad; password and TLS controls remain necessary. Do not make production-network changes.

## Changes prepared, not applied

- `prototypes/cloudflare-commerce-cron/sql/staging-probe-setup.sql` targets **exactly** `cyph1_commerce_development`, checks `current_database()` and restricted role attributes **before writes**, creates an isolated schema and a `cyph1_hyperdrive_probe_jobs` table, and grants only intended table SELECT and status UPDATE. It does **not** create roles or set passwords.
- `staging-probe-cleanup.sql` fails closed outside development and uses `DROP SCHEMA ... RESTRICT`, not CASCADE.
- The existing proof-of-concept transaction harness references the unqualified table; the restricted role's reviewed search_path points at its intended private schema. Verify effective resolution under the restricted role during an independently approved live probe.
- Unit tests test SQL guardrails; no SQL is executed by CI.

## Must happen before any database changes

1. Confirm backups, actual DB identity and operator access again. The dedicated role must be created **out of band** with a strong secret in the approved secret manager (do not paste in chat, git, logs or screenshots), LOGIN but neither SUPERUSER nor CREATEDB nor CREATEROLE, no inherited commerce roles. Verify it does not inherit access to existing commerce tables through PUBLIC or other privileges.
2. Independently verify role privileges, schema defaults and actual effective CONNECT/USAGE. PostgreSQL PUBLIC grants on the database and the `public` schema are not changed automatically because blanket revocation could disrupt existing commerce staging.
3. Assess the Render development database's broad external allowlist (`0.0.0.0/0`), TLS certificate validation, Cloudflare Hyperdrive's connection requirements and no-additional-cost assertion. **Do not loosen or adjust either database's network allowlist merely to pass the test.** Escalate if secure connectivity cannot be established.
4. Request separate explicit approval for role provisioning, setup SQL, Hyperdrive configuration, and test Worker deployment after presenting exact resources, network changes and cost implications.
5. Keep `COMMERCE_CRON_ENABLED=false` and checkout/payment/email/fulfilment flags disabled. The future probe must use synthetic jobs only and cannot send emails or mutate actual commerce tables.

## Future live test (not in this PR)

Test concurrent `FOR UPDATE SKIP LOCKED` claims, rollback, timeouts, connections and TLS, CPU and Hyperdrive usage, missed Cron ticks, double delivery prevention, and an explicit cleanup path. Until measured, compatibility and £0 additional ongoing cost remain unproven.
