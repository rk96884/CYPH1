ALTER TABLE operator_commands
  DROP CONSTRAINT operator_commands_status_check;

ALTER TABLE operator_commands
  ADD CONSTRAINT operator_commands_status_check
  CHECK (status = ANY (ARRAY['reserved'::text, 'pending'::text, 'completed'::text, 'failed'::text, 'resolution_required'::text]));
