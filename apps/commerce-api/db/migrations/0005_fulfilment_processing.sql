ALTER TABLE orders DROP CONSTRAINT orders_fulfilment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_status_check CHECK (
  fulfilment_status IN ('unfulfilled', 'queued', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned', 'manual_review')
);

ALTER TABLE fulfilments
  ADD COLUMN request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN failure_code text,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN returned_at timestamptz;

CREATE UNIQUE INDEX fulfilments_provider_reference_unique
  ON fulfilments (provider, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE fulfilment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  fulfilment_id uuid NOT NULL REFERENCES fulfilments(id),
  target_status text NOT NULL CHECK (target_status IN ('accepted', 'dispatched', 'delivered', 'cancelled', 'returned', 'failed')),
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'requires_review')),
  correlation_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX fulfilment_events_fulfilment_received_idx
  ON fulfilment_events (fulfilment_id, received_at DESC);

ALTER TABLE outbox_events ADD COLUMN last_error_code text;
