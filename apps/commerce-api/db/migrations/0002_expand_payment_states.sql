ALTER TABLE payments DROP CONSTRAINT payments_status_check;

ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (
  status IN (
    'created',
    'pending',
    'authorised',
    'captured',
    'resolution_required',
    'failed',
    'cancelled',
    'expired',
    'partially_refunded',
    'refunded',
    'dispute_opened',
    'dispute_resolved'
  )
);
