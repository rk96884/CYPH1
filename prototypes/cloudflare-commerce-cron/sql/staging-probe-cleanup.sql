-- REVIEW-ONLY. Requires separate approved staging-only execution.
-- Ensure no active Hyperdrive connections; revoke role credentials and bindings first.
BEGIN;
DROP SCHEMA IF EXISTS cyph1_hyperdrive_probe CASCADE;
-- Role intentionally not dropped automatically: operator checks dependencies.
COMMIT;
