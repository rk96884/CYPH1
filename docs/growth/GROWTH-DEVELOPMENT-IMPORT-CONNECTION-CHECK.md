# Development Growth importer — credential smoke test

The `growth_import_dev` PostgreSQL role was created and its grants were checked from the administrator's connection. This workflow adds **a separate read-only authentication check using that actual restricted login**.

## How it works

The workflow runs manually on `main`, in the existing `development-db` GitHub Environment. It reads the existing `DEVELOPMENT_DATABASE_URL` (owner's development connection string) and `GROWTH_IMPORT_ROLE_PASSWORD` **environment secrets**, then constructs an in-memory connection using the `growth_import_dev` username. It never prints the connection string, credentials or raw driver errors.

The smoke script connects to the exact `cyph1_commerce_development` database and checks:
- Login identity is `growth_import_dev`, not the commerce owner.
- Read and insert grants exist on approved growth research tables.
- No read/write table grants exist on customer, order, payment, outreach draft or suppression tables.
- The importer can run one read-only `SELECT COUNT(*) FROM growth.prospects`.

It **never executes INSERT, UPDATE, CREATE ROLE or other database writes**, and does not store credentials in application configuration, artifacts, website variables or logs. All commands executed through the smoke script are read-only `SELECT` statements.

## How to run

After merge, open **Actions → Development Growth importer connection check** and run the workflow on `main`. No action or confirmation parameters are needed.

Expected output:
```
Restricted development Growth importer authenticated; least-privilege read checks passed.
Existing prospect records: 0. No database writes performed.
```

If the check fails, don't change production or reuse the owner's URL in the importer. Investigate the restricted password, role grants or TLS settings. The workflow logs deliberately suppress credential-bearing PostgreSQL error text.

This read-only test is independent of the manual research ingestion CLI; it does not authorise importing candidate data or contacting prospects.
