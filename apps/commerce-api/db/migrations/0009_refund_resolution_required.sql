ALTER TABLE refunds DROP CONSTRAINT refunds_status_check;

ALTER TABLE refunds
  ADD CONSTRAINT refunds_status_check
  CHECK (status IN ('created', 'pending', 'completed', 'failed', 'cancelled', 'resolution_required'));

CREATE INDEX refunds_resolution_required_created_idx
  ON refunds (created_at)
  WHERE status = 'resolution_required';
