-- REVIEW ONLY: Execute only after separately approved development-DB change.
-- Database identity confirmed via Render read-only inspection 2026-10-14.
-- Requires a separately provisioned restricted LOGIN role cyph1_hyperdrive_probe.
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cyph1_commerce_development' THEN
    RAISE EXCEPTION 'REFUSED: Hyperdrive probe targets development DB only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cyph1_hyperdrive_probe'
    AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole) THEN
    RAISE EXCEPTION 'REFUSED: dedicated restricted LOGIN role missing or privileged';
  END IF;
END
$guard$;
CREATE SCHEMA IF NOT EXISTS cyph1_hyperdrive_probe;
REVOKE ALL ON SCHEMA cyph1_hyperdrive_probe FROM PUBLIC;
CREATE TABLE IF NOT EXISTS cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed'))
);
REVOKE ALL ON TABLE cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs FROM PUBLIC;
GRANT USAGE ON SCHEMA cyph1_hyperdrive_probe TO cyph1_hyperdrive_probe;
GRANT SELECT, UPDATE (status) ON cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs TO cyph1_hyperdrive_probe;
ALTER ROLE cyph1_hyperdrive_probe IN DATABASE cyph1_commerce_development
  SET search_path TO cyph1_hyperdrive_probe, pg_catalog;
COMMIT;
-- Note: Database CONNECT and public schema USAGE may be inherited from PUBLIC.
-- Review and restrict role privileges before use; do not revoke PUBLIC globally
-- on a shared development database without a separate impact review.
-- Seed separately ONLY after owner approval:
-- INSERT INTO cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs(status) VALUES ('pending'),('pending');
