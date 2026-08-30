ALTER TABLE webhook_events
  ADD COLUMN correlation_id uuid;

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  raw_body bytea NOT NULL,
  raw_body_sha256 varchar(64) NOT NULL CHECK (raw_body_sha256 ~ '^[0-9a-f]{64}$'),
  verification_outcome text NOT NULL DEFAULT 'pending'
    CHECK (verification_outcome IN ('pending', 'actionable', 'irrelevant', 'invalid', 'malformed', 'verification_error')),
  correlation_id uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

CREATE INDEX webhook_deliveries_received_idx ON webhook_deliveries (provider, received_at DESC);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'published', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_events_pending_idx
  ON outbox_events (processing_status, available_at)
  WHERE processing_status IN ('pending', 'failed');
