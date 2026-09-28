ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_command_type_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_command_type_check
  CHECK (command_type IN ('refund.create', 'outbox.retry', 'payment.capture'));
ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_status_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_status_check
  CHECK (status IN ('reserved', 'completed', 'failed', 'resolution_required'));

-- A release is never automatically repeated, even with a new idempotency key.
CREATE UNIQUE INDEX operator_capture_order_unique ON operator_commands (target_id)
  WHERE command_type = 'payment.capture';
