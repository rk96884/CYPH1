# Production off-platform backup evidence — 24 September 2026

**Status:** Initial production backup and freshness monitoring passed

## Backup control

The production PostgreSQL backup workflow uses PostgreSQL 17 `pg_dump` in custom format, validates a non-empty `PGDMP` dump, encrypts it with age, decrypts and byte-compares the encrypted backup before upload, uploads only the encrypted `.dump.age` object to the private EU R2 bucket under the isolated `production/` prefix, and removes runner-local plaintext/encryption material after the job.

The production database is supplied through the GitHub Actions secret `COMMERCE_PRODUCTION_DATABASE_URL`; credential values are not recorded in repository evidence. The workflow also fails closed if its configured database URL does not identify a production database.

The scheduled production backup runs daily at 02:17 UTC.

## First production run

On 24 September 2026, manual run **Production encrypted R2 backup #1** completed successfully. Confirmed successful steps were:

- configuration verification;
- PostgreSQL 17 client and age setup;
- production database dump creation and validation;
- authenticated encryption and decrypt/compare round-trip;
- encrypted upload to private R2;
- runner-local backup material removal.

This establishes the first encrypted off-platform production database backup in R2.

## Freshness monitoring

The production freshness monitor is isolated to the R2 `production/` prefix, so development backups cannot satisfy the production check. It validates that the newest object is a non-empty `.dump.age` object and no more than 36 hours old. The monitor is scheduled daily at 03:47 UTC.

On 24 September 2026, manual run **Production backup freshness monitor #1** completed successfully. The real R2 configuration and newest-production-backup freshness checks passed. The manual-only deliberate notification-route failure was skipped, as intended.

## Scope and remaining controls

This evidence establishes successful production off-platform backup creation plus independent freshness detection. It does **not** by itself prove a production R2 restore. A production off-platform restore rehearsal, approved retention/lifecycle policy, encryption-key custody/rotation arrangements, alert/operational ownership, and future restore testing after real production data exists remain separate controls.
