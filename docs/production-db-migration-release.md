# Production database schema release

This workflow **does not copy staging data** or reset production. It runs the existing ordered, checksum-verified PostgreSQL migrations against production.

## One-time GitHub setup (required before first run)

1. In **Settings → Environments**, create `production-db`.
2. Add **required reviewers** for this environment, and disable self-review if supported by the repository plan. The workflow's environment name **does not automatically enforce approval**; configure protection rules explicitly.
3. Add the environment secret `PRODUCTION_DATABASE_URL` (production PostgreSQL connection string). Do not add staging credentials.
4. Set environment variable `PRODUCTION_DATABASE_SSL=true` if the production provider requires verified TLS. The current driver uses `rejectUnauthorized: true`; ensure the provider certificate chain is trusted.
5. Confirm an up-to-date **production** backup and a documented, tested recovery route. A staging backup is unnecessary.
6. Confirm the GitHub-hosted runner can reach production PostgreSQL, or switch to an approved private runner. Never expose the database publicly merely to run migrations.

## Release steps

1. Merge reviewed migration files into `main` through the normal PR and CI process.
2. Open **Actions → Production database schema migrations → Run workflow**, select branch `main` and action **plan**.
3. Approve the protected environment (if configured). Inspect the pending migration list, read-only preflight findings and any drift errors. The preflight blocks duplicate capture-command targets, flags in-flight communications for review and reports existing shipping data counts; it cannot prove application-write compatibility.
4. **Review every actual pending SQL file (including migration 0020 if present)** for table locks, destructive DDL, data backfills, dependencies, and application compatibility. The plan lists files and checks checksums; it is **not** a SQL dry-run or safety analysis.
5. Confirm production backup/recovery readiness and schedule a maintenance window if required.
6. Run the workflow again from `main` with action **apply**, entering `APPLY-PRODUCTION-MIGRATIONS` in the confirmation input. Approve the protected environment.
7. The workflow runs the plan and preflight, applies only pending migrations with the existing advisory-lock runner, runs the schema verifier (its temporary test records are rolled back), and prints a final migration report.
8. Check production API health/readiness and application behaviour. If anything fails, investigate and follow the documented recovery procedure. Do **not** assume rolling back the code automatically reverses a database migration.

**Safety notes:** The workflow never runs on pull requests and refuses non-`main` dispatches. `plan` is read-only except normal connection/session operations; it does not create a migration table. `apply` changes production schema and may also change data if a migration SQL file includes DML. Production data remains environment-specific, and no seed command is run. The runner wraps each migration in its own transaction; the entire pending batch is **not** one atomic transaction.

## Release record — 12 October 2026

**Status: completed (schema migration and API health verification).**

- Target: Render PostgreSQL database `cyph1-commerce-production`. Production and staging data remained separate; no staging data was copied.
- GitHub Actions: **Production database schema migrations #4**, dispatched from `main` with action `apply`; workflow reported **Success**.
- Starting state: 10 applied migrations, 10 pending (`0011_operator_capture.sql` through `0020_inpost_collection_review.sql`).
- Final migration plan: **20 applied, 0 pending**. The workflow's schema verification passed.
- Read-only preflight: 0 duplicate payment-capture target groups; 0 in-flight communications; 0 capture-command backfill candidates; 0 shipping rates and 0 existing orders at the time of the check.
- Recovery preparation: Render showed a **3-day point-in-time recovery window**. A production logical export was marked completed on **12 October 2026 at 15:42 UK local time**, and the operator confirmed downloading and securely saving the `.dir.tar.gz` archive outside Render. **A full restoration was not tested.**
- Post-migration live API checks: `https://commerce.cyph1.co.uk/health` returned **OK** and `https://commerce.cyph1.co.uk/ready` returned **Ready**, as confirmed by the operator.
- Scope and limits: this verifies migration-version alignment and basic API/database readiness, **not** parity of staging/production data or settings. No end-to-end production checkout/payment transaction was performed. Product, pricing, shipping, and compliance launch gates remain separate.

Evidence: [GitHub Actions run #4](https://github.com/rk96884/CYPH1/actions/workflows/production-db-migrations.yml) (open the successful run titled **Production database schema migrations #4**); Render export completion and API responses were confirmed during the release review. Do not place backup files or database credentials in this repository.
