# Database backup and restore rehearsal

**Status:** Engineering baseline; first isolated restore is outstanding  
**Last engineering update:** 7 September 2026

## Purpose

Prove that a commerce database backup can be restored into an isolated database
and validated without changing the source database or redirecting a staging
service. A backup is not considered recoverable until this procedure succeeds.

## Current Render limitation

The current development database uses Render's Free Postgres compute plan.
Render documents that Free Postgres has no managed backup, logical-export or
point-in-time recovery facility and expires 30 days after creation. The Hobby
workspace's three-day point-in-time window applies only to a **paid** Postgres
instance.

Until the database is upgraded, use `pg_dump` through the external TLS URL and
restore only into a distinct empty local or temporary database. Before
production, move to paid Postgres, verify Render point-in-time recovery and add
an encrypted off-platform backup schedule.

## Safety rules

- Never restore into the source development/staging database.
- Never use `--clean`, `--create`, `DROP DATABASE` or `DROP SCHEMA` against a
  database containing useful data.
- Keep checkout, payment webhooks and commerce disabled throughout this drill.
- Use PostgreSQL client tools matching the source database's major version.
- Do not paste database URLs into source control, screenshots, issues or chat.
- Store the temporary dump outside the repository and delete it securely after
  recording privacy-safe evidence.
- Use synthetic staging data only. Do not copy future production personal data
  into a local development environment.

## Prerequisites

1. Install the matching PostgreSQL client tools (`pg_dump`, `pg_restore` and
   `psql`). They are not currently installed on the CYPH/1 Windows workstation.
2. Obtain the source database's external Render URL from its **Info** page.
3. Create a completely empty target database whose name contains `restore`,
   `recovery` or `test`, for example `cyph1_commerce_restore_test`.
4. Confirm the source and target PostgreSQL major versions are compatible.
5. Record a UTC start time, source environment, source commit and operator role.

The current Render workspace permits only one active Free Postgres database, so
the isolated target must be local or separately paid. Do not delete the source
to make room for a second Free database.

## Create the logical backup

Use a temporary directory outside the repository. In PowerShell:

```powershell
$rehearsalDirectory = Join-Path $env:TEMP "cyph1-restore-rehearsal"
New-Item -ItemType Directory -Force -Path $rehearsalDirectory | Out-Null
$backupPath = Join-Path $rehearsalDirectory "cyph1-commerce-staging.dump"
$env:SOURCE_DATABASE_URL = "<Render external database URL>"

pg_dump --format=custom --no-owner --no-privileges `
  --file=$backupPath $env:SOURCE_DATABASE_URL

if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
Get-Item -LiteralPath $backupPath | Select-Object Name, Length, LastWriteTimeUtc
Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath
```

Record only the filename, byte length, UTC creation time and SHA-256 digest.
Do not record the URL or dump contents.

## Restore into the isolated target

Set the empty target's connection string, then restore without destructive
flags:

```powershell
$env:RESTORE_DATABASE_URL = "<empty restore-test database URL>"

pg_restore --no-owner --no-privileges --exit-on-error `
  --dbname=$env:RESTORE_DATABASE_URL $backupPath

if ($LASTEXITCODE -ne 0) { throw "pg_restore failed." }
```

If the restore reports existing objects, stop and create a new empty target.
Do not add `--clean` as a workaround.

## Verify the restored database

The comparison command reads only migration versions/checksums and aggregate
row counts from repeatable-read, read-only transactions. Its explicit guards
reject the same source and target and reject a target without a rehearsal name.

```powershell
$env:SOURCE_DATABASE_SSL = "true"
$env:RESTORE_DATABASE_SSL = "false"
$env:ALLOW_DATABASE_RESTORE_VERIFICATION = "true"
$env:DATABASE_RESTORE_VERIFICATION_CONFIRM = "restore-rehearsal"

npm run db:verify:restore
if ($LASTEXITCODE -ne 0) { throw "Restore comparison failed." }

$originalDatabaseUrl = $env:DATABASE_URL
$originalDatabaseSsl = $env:DATABASE_SSL
$env:DATABASE_URL = $env:RESTORE_DATABASE_URL
$env:DATABASE_SSL = $env:RESTORE_DATABASE_SSL
npm run db:verify
if ($LASTEXITCODE -ne 0) { throw "Restored schema verification failed." }
$env:DATABASE_URL = $originalDatabaseUrl
$env:DATABASE_SSL = $originalDatabaseSsl
```

Expected comparison ending:

```text
Verified matching migration history: 9 migrations.
Verified matching aggregate row counts: 23 tables.
Restore comparison passed without reading personal-data fields.
```

The normal schema verifier then checks required constraints inside a transaction
and rolls all its test records back.

## Cleanup

1. Remove all temporary environment variables from the PowerShell session.
2. Delete the temporary dump only after the rehearsal evidence is recorded.
3. Delete the isolated local/temporary restore database through its normal
   administrative process. Reconfirm its exact name before deletion.
4. Confirm `/health` and `/ready` on customer and operations staging still use
   the unchanged source database.
5. Keep all commerce exposure gates disabled.

## Evidence and pass criteria

Record only:

- source environment and source commit;
- PostgreSQL major version and client-tool version;
- backup UTC time, size and SHA-256 digest;
- restore target category and non-sensitive database name;
- restore start/end times;
- matching migration/table counts and schema-verifier outcome;
- confirmation that no service was repointed;
- cleanup outcome, operator role and follow-up owner.

The drill passes only if the restore command succeeds, aggregate comparison and
schema verification pass, the source remains unchanged and the temporary copy
is handled according to the approved retention procedure.

## Paid-plan rehearsal before production

After upgrading to paid Render Postgres, separately exercise point-in-time
recovery from the database's **Recovery** page. Render creates a new database
instance for the selected recovery time; validate it in isolation before any
cutover. Also create, download and restore a Render logical export, then verify
the off-platform encrypted backup schedule and missing-backup alert.

Authoritative reference:
[Render Postgres recovery and backups](https://render.com/docs/postgresql-backups).
