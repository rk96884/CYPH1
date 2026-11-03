# Provision a restricted Growth import account — development only

The development database now has all six Growth Agent tables. This procedure provisions a **separate PostgreSQL login** named `growth_import_dev` for subsequent manually approved research imports, with **no access to commerce orders, payments or customers**.

## Before running

In GitHub **Settings → Environments → development-db**, retain:
- Environment secret `DEVELOPMENT_DATABASE_URL`: current Render development database external URL (existing).
- Environment variable `DEVELOPMENT_DATABASE_SSL`: `true` (existing).

Add one **new environment secret**:
- `GROWTH_IMPORT_ROLE_PASSWORD`: a newly generated, random, unique password of at least 32 characters; avoid newline characters. Store it in a secure password manager as well. It must **not** be the Render database owner's password, a Mollie key, or any existing CYPH/1 secret.

Never paste either database URL or password into chat, an issue, commits, screenshots, workflow inputs or application logs. GitHub Actions environment secrets are used solely inside a manually invoked, protected workflow.

## Workflow: plan, then apply

Open **Actions → Development Growth import role** (`.github/workflows/development-growth-import-role.yml`), branch `main`.

1. Run with `action=plan` and confirmation blank. The script connects to the database in **read-only mode**, verifies the exact database name `cyph1_commerce_development`, the applied Growth migration, exactly six growth tables, revoked PUBLIC schema privileges, and absence of `growth_import_dev`.
2. Confirm the plan succeeds. The account is not yet created.
3. Run with `action=apply` and confirmation **`CREATE-DEVELOPMENT-GROWTH-ROLE`**. The script creates the account and grants rights in one transaction; it verifies rights **before committing**. Failure rolls back the transaction.

This is *not* a scheduled workflow and does not run on merge. GitHub Environment approval protection may be enabled separately.

## Granted

The role is `LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` and receives only:
- `USAGE` on the `growth` schema
- `SELECT, INSERT` on `growth.research_runs`, `growth.prospects`, `growth.prospect_evidence`
- Column-limited `UPDATE(status, completed_at)` on `growth.research_runs`
- `INSERT` on `growth.audit_log`, and `USAGE` on its ID sequence
- `CONNECT` on the development database

No role grants are made on `growth.outreach_drafts`, `growth.suppression_list`, any `public` commerce tables, production or another database. Validation checks that the role lacks table privileges on `public.orders`, `public.payments` and `public.customers`, and on outreach/suppression tables.

## After apply

The workflow deliberately **does not construct, display, or save** a connection URL for the importer. The credential must be assembled privately using the stored password and the approved Render development database hostname, port and database name; do not reuse the database owner's URL directly.

For development-only import, the existing CLI requires:
- `GROWTH_IMPORT_DATABASE_URL`: a URL whose username is `growth_import_dev` and password is the dedicated secret.
- `GROWTH_IMPORT_ENV=development`
- `GROWTH_IMPORT_DATABASE_SSL=true` for external TLS connections.

Keep these credentials off all public web/front-end environments and never add them to Cloudflare Pages. The importer remains **manual** and requires `--apply --confirm=IMPORT-REVIEWED-RESEARCH`.

The six Growth tables are currently empty; no fake prospects should be inserted. The private Growth dashboard uses an authenticated read API and does not require this writer's credentials.

## Reruns and recovery

An existing `growth_import_dev` account causes `plan` and `apply` to fail closed. Do not rotate the password or modify grants by rerunning provisioning; handle changes as a separate reviewed operation. Do not weaken the role checks to force success.

## CI

```sh
node --test apps/commerce-api/scripts/provision-development-growth-role.test.mjs
```

Tests mock SQL; no real database is contacted in CI.
