CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'private', 'active', 'retired')),
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  tax_code text NOT NULL,
  fulfilment_sku text,
  shipping_weight_grams integer CHECK (shipping_weight_grams > 0),
  content_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  location_key text NOT NULL,
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  safety_stock integer NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  source text NOT NULL,
  source_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, location_key),
  CHECK (reserved_quantity <= available_quantity)
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalised text NOT NULL UNIQUE,
  email_display text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retention_review_at timestamptz,
  CHECK (email_normalised = lower(email_normalised))
);

CREATE TABLE customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('granted', 'withdrawn')),
  wording_version text NOT NULL,
  source text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  recipient_name text NOT NULL,
  line_1 text NOT NULL,
  line_2 text,
  locality text NOT NULL,
  region text,
  postal_code text NOT NULL,
  country_code varchar(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'test', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shipping_zone_countries (
  country_code varchar(2) PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  zone_id uuid NOT NULL REFERENCES shipping_zones(id),
  destination_status text NOT NULL DEFAULT 'disabled'
    CHECK (destination_status IN ('disabled', 'test', 'active', 'restricted')),
  restriction_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, zone_id),
  CHECK (destination_status <> 'restricted' OR restriction_reason IS NOT NULL)
);

CREATE TABLE shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'test', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES shipping_zones(id),
  shipping_method_id uuid NOT NULL REFERENCES shipping_methods(id),
  country_code varchar(2),
  rate_minor bigint NOT NULL CHECK (rate_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  minimum_order_minor bigint CHECK (minimum_order_minor >= 0),
  maximum_order_minor bigint CHECK (maximum_order_minor >= 0),
  minimum_weight_grams integer CHECK (minimum_weight_grams >= 0),
  maximum_weight_grams integer CHECK (maximum_weight_grams > 0),
  free_shipping_threshold_minor bigint CHECK (free_shipping_threshold_minor >= 0),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'test', 'active')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (maximum_order_minor IS NULL OR minimum_order_minor IS NULL OR maximum_order_minor >= minimum_order_minor),
  CHECK (maximum_weight_grams IS NULL OR minimum_weight_grams IS NULL OR maximum_weight_grams >= minimum_weight_grams),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  FOREIGN KEY (country_code, zone_id) REFERENCES shipping_zone_countries(country_code, zone_id),
  UNIQUE (zone_id, shipping_method_id, country_code, version)
);

CREATE UNIQUE INDEX shipping_rates_zone_default_version_unique
  ON shipping_rates (zone_id, shipping_method_id, version)
  WHERE country_code IS NULL;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'paid', 'cancelled', 'refunded', 'partially_refunded')),
  fulfilment_status text NOT NULL DEFAULT 'unfulfilled' CHECK (fulfilment_status IN ('unfulfilled', 'queued', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  delivery_minor bigint NOT NULL DEFAULT 0 CHECK (delivery_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  delivery_address_snapshot jsonb NOT NULL,
  billing_address_snapshot jsonb,
  shipping_rate_id uuid REFERENCES shipping_rates(id),
  shipping_country_code varchar(2) CHECK (shipping_country_code ~ '^[A-Z]{2}$'),
  shipping_method_snapshot jsonb,
  shipping_rate_snapshot jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  CHECK (discount_minor <= subtotal_minor),
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor + delivery_minor),
  CHECK (
    (shipping_rate_id IS NULL AND shipping_country_code IS NULL AND shipping_method_snapshot IS NULL AND shipping_rate_snapshot IS NULL)
    OR
    (shipping_rate_id IS NOT NULL AND shipping_country_code IS NOT NULL AND shipping_method_snapshot IS NOT NULL AND shipping_rate_snapshot IS NOT NULL)
  )
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_id uuid NOT NULL REFERENCES products(id),
  sku_snapshot text NOT NULL,
  name_snapshot text NOT NULL,
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  unit_weight_grams integer CHECK (unit_weight_grams > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  line_total_minor bigint NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (line_total_minor = unit_price_minor * quantity + tax_minor)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'authorised', 'captured', 'failed', 'cancelled', 'expired', 'partially_refunded', 'refunded')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  idempotency_key text NOT NULL UNIQUE,
  provider_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payments_provider_reference_unique
  ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  provider_refund_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'completed', 'failed', 'cancelled')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX refunds_provider_reference_unique
  ON refunds (payment_id, provider_refund_id) WHERE provider_refund_id IS NOT NULL;

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text,
  event_type text NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  payload_reference text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX webhook_events_provider_reference_unique
  ON webhook_events (provider, provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE TABLE fulfilments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL,
  provider_reference text,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'queued', 'accepted', 'dispatched', 'delivered', 'cancelled', 'returned', 'failed')),
  tracking_carrier text,
  tracking_reference text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  delivered_at timestamptz
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  correlation_id uuid NOT NULL,
  change_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_levels_product_id_idx ON inventory_levels (product_id);
CREATE INDEX customer_consents_customer_recorded_idx ON customer_consents (customer_id, recorded_at DESC);
CREATE INDEX addresses_customer_id_idx ON addresses (customer_id);
CREATE INDEX shipping_zone_countries_zone_idx ON shipping_zone_countries (zone_id);
CREATE INDEX shipping_rates_lookup_idx ON shipping_rates (zone_id, shipping_method_id, country_code, status, effective_from);
CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at DESC);
CREATE INDEX orders_status_created_idx ON orders (status, created_at);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX payments_order_created_idx ON payments (order_id, created_at DESC);
CREATE INDEX payments_status_updated_idx ON payments (status, updated_at);
CREATE INDEX refunds_payment_created_idx ON refunds (payment_id, created_at DESC);
CREATE INDEX webhook_events_status_received_idx ON webhook_events (processing_status, received_at);
CREATE INDEX fulfilments_order_created_idx ON fulfilments (order_id, created_at DESC);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_correlation_idx ON audit_events (correlation_id);

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inventory_levels_set_updated_at BEFORE UPDATE ON inventory_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shipping_zones_set_updated_at BEFORE UPDATE ON shipping_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shipping_zone_countries_set_updated_at BEFORE UPDATE ON shipping_zone_countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shipping_methods_set_updated_at BEFORE UPDATE ON shipping_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shipping_rates_set_updated_at BEFORE UPDATE ON shipping_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER fulfilments_set_updated_at BEFORE UPDATE ON fulfilments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION enforce_refund_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payment_amount bigint;
  completed_refunds bigint;
  payment_currency varchar(3);
BEGIN
  SELECT amount_minor, currency INTO payment_amount, payment_currency
    FROM payments WHERE id = NEW.payment_id FOR UPDATE;

  IF payment_currency <> NEW.currency THEN
    RAISE EXCEPTION 'Refund currency must match payment currency';
  END IF;

  IF NEW.status = 'completed' THEN
    SELECT COALESCE(sum(amount_minor), 0) INTO completed_refunds
      FROM refunds
      WHERE payment_id = NEW.payment_id AND status = 'completed' AND id <> NEW.id;
    IF completed_refunds + NEW.amount_minor > payment_amount THEN
      RAISE EXCEPTION 'Completed refunds exceed payment amount';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_enforce_limit BEFORE INSERT OR UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION enforce_refund_limit();
