ALTER TABLE outbox_events ADD COLUMN processing_started_at timestamptz;
ALTER TABLE communication_deliveries ADD COLUMN processing_started_at timestamptz;

UPDATE outbox_events SET processing_status='failed', available_at=now(),
  last_error_code='worker_restart_recovery' WHERE processing_status='processing';
UPDATE communication_deliveries SET status='failed', available_at=now(),
  last_error_code='worker_restart_recovery', updated_at=now() WHERE status='processing';

DROP INDEX IF EXISTS outbox_events_pending_idx;
CREATE INDEX outbox_events_claim_idx ON outbox_events(processing_status,available_at,processing_started_at,created_at)
  WHERE processing_status IN ('pending','processing','failed');
DROP INDEX IF EXISTS communication_deliveries_claim_idx;
CREATE INDEX communication_deliveries_claim_idx ON communication_deliveries(status,available_at,processing_started_at,created_at)
  WHERE status IN ('pending','processing','failed');
