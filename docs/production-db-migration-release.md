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
3. Approve the protected environment (if configured). Inspect the pending migration list and any drift errors.
4. **Review the actual pending SQL** for table locks, destructive DDL, data backfills, dependencies, and application compatibility. The plan lists files and checks checksums; it is **not** a SQL dry-run or safety analysis.
5. Confirm production backup/recovery readiness and schedule a maintenance window if required.
6. Run the workflow again from `main` with action **apply**, entering `APPLY-PRODUCTION-MIGRATIONS` in the confirmation input. Approve the protected environment.
7. The workflow runs the plan, applies only pending migrations with the existing advisory-lock runner, runs the schema verifier (its temporary test records are rolled back), and prints a final migration report.
8. Check production API health/readiness and application behaviour. If anything fails, investigate and follow the documented recovery procedure. Do **not** assume rolling back the code automatically reverses a database migration.

**Safety notes:** The workflow never runs on pull requests and refuses non-`main` dispatches. `plan` is read-only except normal connection/session operations; it does not create a migration table. `apply` changes production schema and may also change data if a migration SQL file includes DML. Production data remains environment-specific, and no seed command is run. The runner wraps each migration in its own transaction; the entire pending batch is **not** one atomic transaction.
