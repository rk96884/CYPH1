ALTER TABLE operator_commands
  ADD COLUMN capture_payment_id uuid REFERENCES payments(id),
  ADD COLUMN capture_request jsonb,
  ADD COLUMN capture_provider_context text,
  ADD COLUMN capture_first_attempt_at timestamptz,
  ADD COLUMN capture_claim_id uuid,
  ADD COLUMN capture_claimed_at timestamptz;

-- Only recover the unambiguous payment binding of a legacy reserved command.
-- Never fabricate credential/request/attempt evidence for historical requests.
UPDATE operator_commands c SET capture_payment_id=p.id
  FROM payments p WHERE c.command_type='payment.capture' AND p.order_id=c.target_id
    AND c.result->>'paymentId'=p.id::text;
