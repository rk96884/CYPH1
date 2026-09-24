# Production off-platform backup evidence — 24 September 2026

**Status:** Initial production backup, restore, retention, and encryption-key recovery controls passed

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

## Production R2 restore rehearsal

On 24 September 2026, manual run **Production R2 restore rehearsal #1** completed successfully.

The rehearsal deliberately had no production database URL or Render production database credential. It:

- verified R2 and encryption configuration and refused execution if a `DATABASE_URL` was present;
- selected the newest encrypted object only from the R2 `production/` prefix;
- downloaded and decrypted the backup and verified the PostgreSQL custom-format `PGDMP` header;
- created an isolated PostgreSQL 17 restore target on the disposable GitHub Actions runner;
- restored the production backup into that isolated target;
- verified **10** applied migrations, **23 / 23** expected commerce tables, and **0 / 0 / 0 / 0** customers/orders/payments/refunds, matching the independently established pre-launch production state;
- removed the isolated restore and runner-local encrypted/plaintext/key material after verification.

The live Render production database was not a restore target and was not queried by this rehearsal.

## R2 lifecycle retention

On 24 September 2026, Cloudflare R2 lifecycle rules were enabled for the private `cyph1-commerce-backups` bucket:

- `production/`: delete uploaded objects after **90 days**;
- `development/`: delete uploaded objects after **90 days**.

The existing default incomplete-multipart-upload abort rule remains enabled at seven days. The backup bucket's separately configured 30-day Bucket Lock remains the minimum-deletion protection; the 90-day lifecycle rules define the routine retention/deletion point for encrypted database backups.

## Encryption-key custody and rotation

On 24 September 2026, the backup age identity was rotated after establishing independent recovery custody.

A replacement age identity was generated locally. Its public recipient is:

`age1jr8pudq0sk8knhta4e5yarne3y4wh3r20xr5x7phtlenunmndghq4kr7k2`

The private identity itself is not recorded in repository evidence. Independent protected copies were established on the recovery operator's laptop and phone before the GitHub Actions `BACKUP_AGE_IDENTITY` secret was replaced.

After rotation, manual run **Production encrypted R2 backup #2** completed successfully, including production dump validation, age encryption and decrypt/compare round-trip, private R2 upload, and runner-local cleanup. The resulting encrypted object was `production_2026_09_24_commerce-production-20260924T154143Z-36021967578.dump.age`.

The new encrypted R2 object was then downloaded independently and decrypted locally using the laptop-held recovery identity rather than the GitHub Actions secret. Decryption produced a 79,626-byte dump. A read-only `pg_restore --list` validation identified it as a PostgreSQL custom-format archive created from `cyph1_commerce_production`, with 159 TOC entries and source database version PostgreSQL 17.11. The temporary plaintext recovery-test dump was then deleted and its absence confirmed.

This demonstrates that newly created production backups can be recovered without relying on GitHub retaining the only copy of the age private identity.

Historical R2 objects created before this rotation were encrypted with the previous identity. Because no independent copy of that previous identity is known to be retained, those pre-rotation objects must not be treated as independently recoverable after replacement of the GitHub secret. The verified post-rotation backup is the recovery baseline for the new identity.

## Backup failure alert ownership

On 24 September 2026, the GitHub account responsible for CYPH/1 operations was confirmed to have GitHub Actions notifications configured for **Email (Failed workflows only)**.

A controlled end-to-end notification rehearsal was then run using **Production backup freshness monitor #3**. The workflow first passed the real R2 configuration check and the real newest-production-backup freshness check. Its manual-only notification-route rehearsal step was then deliberately enabled and exited with code 1, causing the overall workflow to fail as designed.

The resulting GitHub Actions failure email was received by the operational owner. This demonstrates the current end-to-end route from a production backup-monitor failure through GitHub Actions to the operator's email inbox.

The deliberate failure did not represent a stale or failed production backup; the real production freshness check passed immediately before the notification test.

## Scope and remaining controls

This evidence establishes the complete initial off-platform chain: production dump creation, encryption round-trip, private R2 upload, freshness monitoring, encrypted retrieval, decryption, isolated PostgreSQL 17 restoration, recovered-state verification, and cleanup.

The initial production R2 recovery path is therefore demonstrated for the current pre-launch empty-data state. The 90-day R2 lifecycle retention policy is now configured. Encryption-key custody and rotation have now been demonstrated for newly created backups. Backup failure alert ownership has now been demonstrated through an end-to-end email rehearsal. Broader production monitoring/operational ownership and future restore testing after real production data exists remain separate controls. The strict zero-record assertions in the current rehearsal must be revised before it is used after live commerce data exists.
