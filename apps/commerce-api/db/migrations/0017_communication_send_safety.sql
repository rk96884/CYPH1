-- Fence claims and distinguish uncertain sends from safe automatic retries.
ALTER TABLE communication_deliveries
  ADD COLUMN claim_token uuid,
  ADD COLUMN send_started_at timestamptz,
  ADD COLUMN terminal_failure boolean NOT NULL DEFAULT false;
ALTER TABLE communication_deliveries DROP CONSTRAINT communication_deliveries_status_check;
ALTER TABLE communication_deliveries ADD CONSTRAINT communication_deliveries_status_check
  CHECK (status IN ('pending','processing','sent','failed','manual_review'));
-- An old in-flight attempt may already have sent: never replay it automatically.
UPDATE communication_deliveries SET status='manual_review',last_error_code='legacy_send_uncertain',
  processing_started_at=NULL,updated_at=now() WHERE status='processing';
