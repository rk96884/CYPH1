ALTER TABLE checkout_sessions DROP CONSTRAINT checkout_sessions_state_check;
ALTER TABLE checkout_sessions DROP CONSTRAINT checkout_sessions_check;

ALTER TABLE checkout_sessions
  ADD CONSTRAINT checkout_sessions_state_check
  CHECK (state IN ('reserved', 'complete', 'failed', 'resolution_required'));

ALTER TABLE checkout_sessions
  ADD CONSTRAINT checkout_sessions_state_payload_check
  CHECK (
    (state = 'reserved' AND checkout_url IS NULL AND failure_code IS NULL)
    OR (state = 'complete' AND order_id IS NOT NULL AND checkout_url IS NOT NULL AND failure_code IS NULL)
    OR (state = 'failed' AND order_id IS NOT NULL AND checkout_url IS NULL AND failure_code IS NOT NULL)
    OR (state = 'resolution_required' AND order_id IS NOT NULL AND checkout_url IS NULL
        AND failure_code = 'ambiguous_provider_outcome')
  );
