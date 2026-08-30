CREATE TABLE checkout_sessions (
  idempotency_key text PRIMARY KEY,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  order_id uuid UNIQUE REFERENCES orders(id),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'complete', 'failed')),
  checkout_url text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state = 'reserved' AND checkout_url IS NULL AND failure_code IS NULL)
    OR (state = 'complete' AND order_id IS NOT NULL AND checkout_url IS NOT NULL AND failure_code IS NULL)
    OR (state = 'failed' AND order_id IS NOT NULL AND checkout_url IS NULL AND failure_code IS NOT NULL)
  )
);

CREATE INDEX checkout_sessions_state_updated_idx
  ON checkout_sessions (state, updated_at);

CREATE TRIGGER checkout_sessions_set_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
