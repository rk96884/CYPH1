-- Provider acceptance is distinct from an uncertain capture outcome.
-- Keep the unique per-order capture index and all historical commands unchanged.
ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_status_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_status_check
  CHECK (status IN ('reserved', 'completed', 'failed', 'resolution_required')
    OR (status = 'pending' AND command_type = 'payment.capture'));
