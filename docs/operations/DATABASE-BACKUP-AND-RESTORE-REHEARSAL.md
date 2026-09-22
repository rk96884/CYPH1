# Database backup and restore rehearsal

**Status:** First isolated logical backup/restore rehearsal passed  
**Last engineering update:** 21 September 2026

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
   `psql`). PostgreSQL 17.11 client tools were installed on the CYPH/1 Windows
   workstation for the first rehearsal.
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
Verified matching migration history: 10 migrations.
Verified matching aggregate row counts: 23 tables.
Restore comparison passed without reading personal-data fields.
```

The normal schema verifier then checks required constraints inside a transaction
and rolls all its test records back.


## First isolated rehearsal evidence — 21 September 2026

The first logical backup and isolated local restore rehearsal passed.

- Source: CYPH/1 Render development/staging PostgreSQL database.
- Client tools: PostgreSQL 17.11.
- Backup file: `cyph1-commerce-staging.dump`.
- Backup created: 21 September 2026 at 16:22:34 UTC.
- Backup size: 87,162 bytes.
- SHA-256: `B02EDB33E71C63A917DFE346F8E55E6D49005BBB4603BCBC0C1CD7B4B9E875B5`.
- Restore target: isolated local database `cyph1_commerce_restore_test`.
- The target was confirmed empty before restore.
- `pg_restore --exit-on-error` completed with exit code 0.
- The restored database contained all 23 required tables.
- Source-versus-restore comparison matched 10 migration records and aggregate
  row counts across all 23 tables without reading personal-data fields.
- Normal schema verification passed all required table, lease-column and
  constraint checks; verifier test records were rolled back.
- No staging service was repointed to the restore target.
- Temporary connection and rehearsal-guard environment variables were removed
  after verification.
- The temporary dump was deleted after evidence capture and its absence was
  confirmed.
- The isolated local restore database was dropped and a subsequent database
  listing returned zero matching rows.

The first rehearsal therefore demonstrates that the logical staging backup can
be restored into an isolated PostgreSQL database and passes the repository's
comparison and schema-integrity checks. The temporary backup artifact and isolated restore database were then deleted,
completing the rehearsal cleanup.

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

## Automated off-platform backup design baseline

The repository now includes a provider-neutral validation boundary for scheduled logical backups. Before an encrypted object may be treated as a successful backup, automation must:

1. create a PostgreSQL custom-format dump with `pg_dump --format=custom --no-owner --no-privileges`;
2. fail on a missing, empty, truncated or non-`PGDMP` dump;
3. encrypt the validated dump before upload using an authenticated/approved encryption mechanism and a secret held outside source control;
4. validate the encrypted envelope and record only privacy-safe metadata: UTC time, byte size and SHA-256 digest;
5. upload only the encrypted object to the approved off-platform destination;
6. remove runner-local plaintext and encrypted temporary files after the upload attempt;
7. independently check backup freshness and fail the monitoring workflow when the newest valid backup exceeds the approved recovery window.

The current implementation deliberately stops at local artifact validation. No storage provider, retention period, encryption secret, production database or scheduled database connection is configured by this baseline. GitHub Actions artifacts are not approved as the production backup store. Storage-provider selection, authenticated encryption implementation, retention/immutability, restore-from-storage rehearsal and missing-backup notification evidence remain open.

## Paid-plan rehearsal before production

After upgrading to paid Render Postgres, separately exercise point-in-time
recovery from the database's **Recovery** page. Render creates a new database
instance for the selected recovery time; validate it in isolation before any
cutover. Also create, download and restore a Render logical export, then verify
the off-platform encrypted backup schedule and missing-backup alert.

Authoritative reference:
[Render Postgres recovery and backups](https://render.com/docs/postgresql-backups).
