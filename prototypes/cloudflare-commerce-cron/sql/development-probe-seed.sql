-- OPERATOR-ONLY: Requires separate approval before running in development psql.
-- Do not execute against production. Two synthetic pending rows allow the
-- transaction test to acquire one lock while another session uses SKIP LOCKED.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cyph1_commerce_development' THEN
    RAISE EXCEPTION 'REFUSED: development database only';
  END IF;
END
$guard$;
INSERT INTO cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs(status)
VALUES ('pending'), ('pending');
COMMIT;
-- The probe itself uses ROLLBACK, leaving these rows pending.
-- Remove the two test rows only in a separate approved cleanup.
