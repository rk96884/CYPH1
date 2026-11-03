# CYPH/1 development migration checksum investigation — 3 November 2026

## Root cause confirmed
Development migrated SQL files `0011`–`0019` with Windows `CRLF` line endings. GitHub Actions checks out those same files with Unix `LF` line endings. SHA256 hashes therefore differ even when the SQL statements are byte-for-byte equivalent after normalising line endings.

We read the existing **development** `public.schema_migrations` checksums and independently verified all nine match SHA256 of the **current committed file content converted from LF to CRLF**. The exact LF hashes match production's recorded checksums for all nine versions.

Read-only comparison of production and development PostgreSQL `public` schema found:
- 26 business/application tables on each side excluding `schema_migrations`, with identical column signatures.
- 85 indexes and 178 constraints on each side, with identical definitions.
- 24 triggers on each side with identical definitions.
- 44 functions on each side; three functions differed only in CRLF versus LF in their stored source bodies.
- No difference in views, enum/domain types, or RLS policies.

This is evidence for line-ending-only history divergence, **not approval to relax other migration integrity checks**.

## Fix
`migration-checksum.mjs` is shared by the plan and migration runner. It:
- Always accepts exact SHA256 of current contents.
- For **only** database identity `cyph1_commerce_development` and the nine exact `0011`–`0019` filenames, also accepts SHA256 of the **current file** encoded with CRLF.
- Rejects edited SQL, unexpected migration versions, invalid hashes, other database names and production mismatches.
- **Does not rewrite `schema_migrations` or modify migration SQL.**

The tests pin all nine observed development hashes. Any subsequent code change that alters even a single non-line-ending byte fails CI. The workflow still requires explicit development confirmation and a clean migration plan.

## Run sequence after merge
1. Run `node --test apps/commerce-api/scripts/migration-checksum.test.mjs` (also enforced by quality CI).
2. From GitHub Actions, run **Development Growth schema migration**, branch `main`, action `plan`, confirmation blank.
3. Expect `Applied: 20; pending: 1`, nine `VERIFIED HISTORICAL CRLF` messages and pending `9000_growth_agent_foundation.sql`, without checksum drift.
4. Verify development recovery point and approve a separate `apply` run with `APPLY-DEVELOPMENT-GROWTH`.
5. Verify 21 migration records and six growth tables on development via read-only Render queries.

No production migration is run by this PR. No import account is provisioned, no prospects are created, and no outreach is enabled.
