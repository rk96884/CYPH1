CREATE TABLE communication_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id uuid NOT NULL REFERENCES outbox_events(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  template_key text NOT NULL CHECK (template_key IN ('order-confirmation','dispatch','cancellation','refund')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
  deduplication_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider text,
  provider_reference text,
  last_error_code text,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX communication_deliveries_claim_idx ON communication_deliveries(status, available_at, created_at);
CREATE UNIQUE INDEX communication_deliveries_source_template_idx ON communication_deliveries(source_event_id, template_key, channel);
