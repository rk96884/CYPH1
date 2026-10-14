-- REVIEW-ONLY. Do not run until independently approved against the STAGING DB.
-- Operator prerequisites: confirm current_database(), database host, role ownership,
-- and CREATE a LOGIN role cyph1_hyperdrive_probe with a securely stored secret.
-- Run as staging database owner; NEVER against production.
BEGIN;
CREATE SCHEMA IF NOT EXISTS cyph1_hyperdrive_probe;
REVOKE ALL ON SCHEMA cyph1_hyperdrive_probe FROM PUBLIC;
CREATE TABLE IF NOT EXISTS cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed'))
);
REVOKE ALL ON TABLE cyph1_hyperdrive_probe.jobs FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM cyph1_hyperdrive_probe;
GRANT CONNECT ON DATABASE cyph1_commerce_staging TO cyph1_hyperdrive_probe;
GRANT USAGE ON SCHEMA cyph1_hyperdrive_probe TO cyph1_hyperdrive_probe;
GRANT SELECT, UPDATE (status) ON cyph1_hyperdrive_probe.jobs TO cyph1_hyperdrive_probe;
ALTER ROLE cyph1_hyperdrive_probe IN DATABASE cyph1_commerce_staging
  SET search_path TO cyph1_hyperdrive_probe, pg_catalog;
COMMIT;
-- Seed with an operator-only command using staging owner after approval:
-- INSERT INTO cyph1_hyperdrive_probe.jobs(status) VALUES ('pending'),('pending');
-- No seed runs from this script.
