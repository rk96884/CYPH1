-- REVIEW ONLY: destructive cleanup; requires separate staging/development approval.
-- First disconnect/disable test Hyperdrive binding and verify no dependencies.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cyph1_commerce_development' THEN
    RAISE EXCEPTION 'REFUSED: Hyperdrive probe cleanup targets development DB only';
  END IF;
END
$guard$;
-- Do not CASCADE: fail if unexpected dependent objects exist.
DROP SCHEMA IF EXISTS cyph1_hyperdrive_probe RESTRICT;
COMMIT;
-- Restricted role and credentials require independent operator review/revocation.
