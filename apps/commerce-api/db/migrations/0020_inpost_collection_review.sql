-- Original checkout destinations remain immutable; authorised alternatives are separate evidence.
CREATE FUNCTION protect_order_delivery_destination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.delivery_address_snapshot IS DISTINCT FROM OLD.delivery_address_snapshot THEN
    RAISE EXCEPTION 'Original order delivery destination is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_immutable_delivery_destination BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION protect_order_delivery_destination();

CREATE TABLE inpost_collection_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  version integer NOT NULL CHECK(version > 0),
  status text NOT NULL CHECK(status IN ('matched','unavailable')),
  collection_point jsonb NOT NULL CHECK(jsonb_typeof(collection_point)='object'),
  customer_authorisation_reference text,
  reason text NOT NULL,
  operator_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,version)
);
CREATE FUNCTION protect_inpost_collection_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Collection review evidence is append-only';
END;
$$;
CREATE TRIGGER inpost_collection_reviews_immutable BEFORE UPDATE OR DELETE ON inpost_collection_reviews
FOR EACH ROW EXECUTE FUNCTION protect_inpost_collection_review();
-- No rates, destinations, packaging, gates or historical orders are changed.
