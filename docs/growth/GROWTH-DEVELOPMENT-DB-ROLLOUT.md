# Growth Agent — development database migration runbook

## Verified baseline (3 November 2026)
- Development Render DB: `cyph1_commerce_development` (`dpg-da9hpq1srm7s73cdb260-a`).
- 20 recorded commerce migrations, latest `0020_inpost_collection_review.sql`.
- **Zero** `growth` tables in development.
- Production is already at 21 migrations, including `9000_growth_agent_foundation.sql`. This procedure **must not** touch production.

## Workflow
`.github/workflows/development-growth-migration.yml` is a manually invoked, separate GitHub Actions workflow protected by the GitHub Environment `development-db`.

Required GitHub environment configuration:
- Environment secret `DEVELOPMENT_DATABASE_URL`: current **external** development DB URL from Render; never the production URL.
- Environment variable `DEVELOPMENT_DATABASE_SSL`: `true` for Render's external TLS connection.

Do not paste either URL into logs, chat, source files or screenshots. Give the environment an approval requirement if your GitHub plan supports one.

1. Confirm the current development database has a recent safe recovery point or approved disposable test-data posture. Do not assume the production backup protects development.
2. Select **Run workflow**, branch `main`, action `plan`, confirmation empty.
3. Review the plan. Expected: `Applied: 20 · Pending: 1`, specifically `9000_growth_agent_foundation.sql`.
4. Only after confirming the database identity and pending list, select action `apply` and enter exactly `APPLY-DEVELOPMENT-GROWTH`.
5. Workflow runs the shared migration runner, verifies the commerce schema, confirms all six Growth tables and reports pending migrations.
6. Read-only verification via Render: 21 recorded migrations, six `growth` tables, no direct PUBLIC usage on the Growth schema.

### Guards
- The preflight must connect to a database whose live SQL `current_database()` exactly equals `cyph1_commerce_development`.
- The repo must contain exactly 21 approved migration files, ending with `9000_growth_agent_foundation.sql`.
- The expected baseline is 20 applied migrations, with `0020` present and no `growth` tables. An already-applied Growth migration is accepted only if six tables exist.
- The existing plan script detects checksum drift and out-of-order migration history before apply.
- The production migration workflow, secret and database are not referenced or changed.

## After migration
The development DB migration **does not create or grant an import user**. Continue separately with the least-privilege role plan in `docs/growth/GROWTH-REVIEWED-IMPORT.md`. The importer must use a restricted role whose name starts `growth_import_`, grants on `growth` only, and an explicit development-only confirmation. Test with approved, genuine public research, not sample records.

**No automatic discovery, ingestion or outreach is activated by this workflow.**
