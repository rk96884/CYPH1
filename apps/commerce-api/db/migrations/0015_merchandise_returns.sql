-- Merchandise records only; existing refunds remain unlinked.
CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_reference text NOT NULL UNIQUE DEFAULT ('RET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))),
  order_id uuid NOT NULL REFERENCES orders(id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','received','closed','rejected','cancelled')),
  request_category text NOT NULL CHECK (request_category IN ('customer_choice','damaged_reported','fault_reported','incorrect_item','delivery_issue','other')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  approved_refund_minor bigint CHECK (approved_refund_minor BETWEEN 0 AND 9007199254740991),
  receipt_required boolean NOT NULL DEFAULT true,
  receipt_waiver_reason text CHECK (receipt_waiver_reason IN ('receipt_not_required','operator_waiver')),
  inspection_outcome text CHECK (inspection_outcome IN ('no_issue_observed','issue_observed','inconclusive','not_applicable')),
  decision_reason text CHECK (decision_reason IN ('operator_approved','not_approved','duplicate_request','request_withdrawn')),
  closure_reason text CHECK (closure_reason IN ('no_refund_due','refund_completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  received_at timestamptz,
  inspected_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, order_id),
  CHECK (receipt_required = (receipt_waiver_reason IS NULL)),
  CHECK ((inspection_outcome IS NULL) = (inspected_at IS NULL)),
  CHECK (inspected_at IS NULL OR received_at IS NOT NULL),
  CHECK (status NOT IN ('approved','received','closed') OR (approved_at IS NOT NULL AND approved_refund_minor IS NOT NULL)),
  CHECK (status <> 'received' OR received_at IS NOT NULL),
  CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND closure_reason IS NOT NULL AND (NOT receipt_required OR (received_at IS NOT NULL AND inspected_at IS NOT NULL)))),
  CHECK ((closed_at IS NULL) = (closure_reason IS NULL)),
  CHECK (status <> 'closed' OR ((closure_reason='no_refund_due' AND approved_refund_minor=0) OR (closure_reason='refund_completed' AND approved_refund_minor>0)))
);
ALTER TABLE order_items ADD CONSTRAINT order_items_id_order_unique UNIQUE (id, order_id);
CREATE TABLE return_items (
  return_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  requested_quantity integer NOT NULL CHECK (requested_quantity > 0),
  approved_quantity integer CHECK (approved_quantity >= 0 AND approved_quantity <= requested_quantity),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= COALESCE(approved_quantity, 0)),
  PRIMARY KEY (return_id, order_item_id),
  FOREIGN KEY (return_id, order_id) REFERENCES returns(id, order_id),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id)
);
ALTER TABLE refunds ADD COLUMN return_id uuid REFERENCES returns(id);
CREATE INDEX returns_order_created_idx ON returns(order_id, created_at);
CREATE INDEX returns_open_updated_idx ON returns(updated_at) WHERE status NOT IN ('closed','rejected','cancelled');
CREATE INDEX return_items_order_item_idx ON return_items(order_item_id);
CREATE INDEX refunds_return_idx ON refunds(return_id) WHERE return_id IS NOT NULL;
CREATE TRIGGER returns_set_updated_at BEFORE UPDATE ON returns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_command_type_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_command_type_check CHECK (command_type IN (
  'refund.create','outbox.retry','payment.capture','return.request','return.approve','return.reject','return.cancel','return.receive','return.inspect','return.close'
));
ALTER TABLE operator_commands DROP CONSTRAINT operator_commands_target_type_check;
ALTER TABLE operator_commands ADD CONSTRAINT operator_commands_target_type_check CHECK (target_type IN ('order','outbox_event','return'));
