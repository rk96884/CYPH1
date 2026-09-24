# Production PostgreSQL PITR recovery evidence — 24 September 2026

**Status:** Passed
**Environment:** Production PostgreSQL recovery rehearsal
**Data classification:** Empty production schema; no customer/order/payment/refund records

## Purpose

Demonstrate that production PostgreSQL point-in-time recovery can create an independent recoverable database and that the recovered copy contains the expected CYPH/1 commerce schema. This rehearsal was performed before production commerce data existed.

## Recovery

Render point-in-time recovery was enabled with a three-day recovery window. A recovery was started using the latest eligible point shown during the exercise: 24 September 2026 at 11:49:15 BST (UTC+01:00). The destination was a separate recovery database, `cyph1-commerce-production-copy`, with existing database settings copied. The source production database was not overwritten or repointed.

The recovered PostgreSQL 17 database reached **Available**.

## Independent verification

The recovered database was accessed directly with PostgreSQL 17 `psql` over TLS. The production web service was not repointed to the recovery database.

Read-only verification returned:

- `schema_migrations`: **10** applied migrations;
- expected CYPH/1 commerce tables present: **23 / 23**;
- customers: **0**;
- orders: **0**;
- payments: **0**;
- refunds: **0**.

The result matches the intended pre-launch production state: migrated schema with no seeded or customer commerce data.

## Conclusion

The production PITR recovery rehearsal **passed**. Evidence demonstrates that an independent database can be recovered from the production PITR stream and that the recovered copy contains the expected schema and empty commerce state.

This closes the infrastructure recovery-rehearsal portion of the production PITR gate. It does not replace separate off-platform encrypted-backup controls, retention approval, recovery-key custody/rotation, operational ownership or future recovery testing once production contains real data.

## Cleanup

The temporary recovered database may be deleted after this evidence is committed. Deleting the recovery copy must not affect the source production database.
