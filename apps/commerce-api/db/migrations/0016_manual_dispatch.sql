-- Additive shipment metadata; existing historical records remain unchanged.
ALTER TABLE fulfilments ADD COLUMN tracking_service text, ADD COLUMN tracking_url text;
ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_command_type_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_command_type_check CHECK (command_type IN (
  'refund.create', 'outbox.retry', 'payment.capture',
  'return.request', 'return.approve', 'return.reject', 'return.cancel',
  'return.receive', 'return.inspect', 'return.close', 'fulfilment.dispatch'
));
