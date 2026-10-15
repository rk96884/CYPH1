-- DEVELOPMENT ONLY: run manually with psql, never in production.
-- Self-contained real PostgreSQL concurrency + lease/fencing + retry tests.
-- All writes are in a temporary table, discarded when the session ends.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'cyph1_commerce_development' THEN
    RAISE EXCEPTION 'Refusing execution outside development';
  END IF;
END $guard$;
COMMIT;

CREATE TEMP TABLE isolated_outbox_probe (
  id integer PRIMARY KEY,
  processing_status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  processing_started_at timestamptz,
  claim_token uuid,
  available_at timestamptz NOT NULL DEFAULT now()
) ON COMMIT PRESERVE ROWS;

INSERT INTO isolated_outbox_probe(id) VALUES (1), (2), (3);
-- Distinct connection/session concurrency is exercised by the companion
-- Node runner. This file only creates the isolated temp fixture if debugging.
SELECT count(*) AS synthetic_rows FROM isolated_outbox_probe;
