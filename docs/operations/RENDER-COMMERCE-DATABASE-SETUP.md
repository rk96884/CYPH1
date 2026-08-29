# Render commerce database setup

**Status:** Preparation only — do not create a production order database until
the commerce launch gate is approved.

This runbook implements ADR 0002 without enabling checkout or payments.

## Development database

Use a separate non-production PostgreSQL database. Never copy live customer,
order or payment data into local or preview environments.

The commerce API reads one private environment value:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Do not prefix this variable with `PUBLIC_`. Do not place a real value in
`.env.example`, source control, build logs or browser-delivered code.

## Render preparation

1. Open the existing CYPH/1 Hobby workspace.
2. Create or select a dedicated project for commerce.
3. Keep no more than the two intended environments: preview/staging and
   production.
4. Create the commerce API as an always-on paid service in Frankfurt.
5. Create a paid Render Postgres instance in Frankfurt.
6. Select PostgreSQL 17 and the `0.5c-1g` plan or larger.
7. Set the API's `DATABASE_URL` to the database's internal URL.
8. Keep `COMMERCE_ENABLED=false`, `PAYMENT_PROVIDER=disabled` and
   `FULFILMENT_MODE=disabled`.
9. Disable unrestricted external database access after required administrative
   addresses have been identified.

Do not paste the internal or external database URL into GitHub issues, chat,
screenshots or support messages. Rotate credentials immediately if exposed.

## Migration policy

- Migrations are immutable after being applied outside a developer machine.
- Every schema change is reviewed and committed.
- Production migrations run as an explicit release operation.
- The API must not silently migrate the production schema during startup.
- Destructive migrations require a tested expansion/migration/contraction plan.
- Back up and rehearse a restore before any material destructive change.

## Backup policy

Render Hobby provides a three-day point-in-time recovery window for paid
Postgres instances. Before launch, add a nightly encrypted `pg_dump` in custom
format to an approved storage account outside Render.

Minimum controls:

- seven daily logical backups;
- four weekly logical backups;
- encryption in transit and at rest;
- storage credentials separate from database credentials;
- quarterly restore rehearsal;
- alert on failed or missing backup;
- documented deletion behaviour for decommissioned databases.

Do not treat an untested backup as recoverable.

## Initial monitoring

Monitor at minimum:

- database storage and connection utilisation;
- slow or failed queries;
- migration failures;
- API/database connection errors;
- backup success and restore-test date;
- Render spend and outbound bandwidth;
- payment/webhook reconciliation once test payments are introduced.

## Launch verification record

Record the following without recording secrets:

| Check | Evidence | Owner | Date |
| --- | --- | --- | --- |
| Paid database plan confirmed |  |  |  |
| Frankfurt colocation confirmed |  |  |  |
| Internal URL in use |  |  |  |
| External access restricted |  |  |  |
| PITR restore rehearsed |  |  |  |
| Off-platform backup restored |  |  |  |
| Cost alerts enabled |  |  |  |
| Commerce flags disabled |  |  |  |
