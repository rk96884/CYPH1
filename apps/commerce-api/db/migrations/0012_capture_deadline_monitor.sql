ALTER TABLE payments
  ADD COLUMN capture_mode text CHECK (capture_mode IN ('automatic', 'manual')),
  ADD COLUMN capture_before timestamptz,
  ADD COLUMN authorised_at timestamptz,
  ADD COLUMN capture_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN capture_monitor_checked_at timestamptz,
  ADD COLUMN capture_monitor_claim_id uuid,
  ADD COLUMN capture_monitor_claimed_at timestamptz,
  ADD COLUMN capture_deadline_state text CHECK (capture_deadline_state IN
    ('safe', 'warning', 'critical', 'overdue', 'missing_deadline', 'reconciliation_required'));

-- No invented deadline or capture-mode backfill. Unknown legacy records are refreshed from the provider.
CREATE INDEX payments_capture_monitor_idx ON payments (capture_monitor_checked_at, capture_before, id)
  WHERE status = 'authorised' AND capture_mode IS DISTINCT FROM 'automatic';

-- Every writer (including webhooks and operator capture) invalidates in-flight provider reads.
CREATE FUNCTION advance_capture_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.status, NEW.capture_mode, NEW.capture_before, NEW.authorised_at,
         NEW.provider, NEW.provider_payment_id, NEW.amount_minor, NEW.currency)
     IS DISTINCT FROM
     ROW(OLD.status, OLD.capture_mode, OLD.capture_before, OLD.authorised_at,
         OLD.provider, OLD.provider_payment_id, OLD.amount_minor, OLD.currency) THEN
    NEW.capture_revision := OLD.capture_revision + 1;
    NEW.capture_monitor_checked_at := NULL;
    NEW.capture_deadline_state := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payments_capture_revision BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION advance_capture_revision();
