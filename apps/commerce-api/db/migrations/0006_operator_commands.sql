CREATE TABLE operator_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  command_type text NOT NULL CHECK (command_type IN ('refund.create', 'outbox.retry')),
  target_type text NOT NULL CHECK (target_type IN ('order', 'outbox_event')),
  target_id uuid NOT NULL,
  operator_id text NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operator_commands_target_created_idx
  ON operator_commands (target_type, target_id, created_at DESC);

CREATE TRIGGER operator_commands_set_updated_at BEFORE UPDATE ON operator_commands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX outbox_events_failed_created_idx
  ON outbox_events (processing_status, created_at)
  WHERE processing_status = 'failed';
