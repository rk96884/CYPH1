-- Additive; requires 0018. No rates, approvals, products or historical orders are changed.
ALTER TABLE shipping_rates ADD COLUMN carrier_tariff jsonb
  CHECK (carrier_tariff IS NULL OR (jsonb_typeof(carrier_tariff) = 'object' AND carrier_tariff ? 'carrier' AND carrier_tariff->>'carrier' = 'royal-mail'));
ALTER TABLE shipping_rates ADD CONSTRAINT carrier_rate_requires_country_band CHECK
  (carrier_tariff IS NULL OR (country_code IS NOT NULL AND maximum_weight_grams IS NOT NULL
    AND minimum_weight_grams IS NOT NULL AND currency='GBP' AND free_shipping_threshold_minor IS NULL));
CREATE TABLE shipping_packaging_profiles (
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  product_id uuid NOT NULL REFERENCES products(id),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','test','active')),
  profile jsonb NOT NULL CHECK (jsonb_typeof(profile)='object'
    AND profile ?& ARRAY['id','version','productId'] AND profile->>'id'=id AND (profile->>'version')::integer=version AND profile->>'productId'=product_id::text),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,version)
);
CREATE INDEX shipping_packaging_product ON shipping_packaging_profiles(product_id,status);
CREATE FUNCTION protect_shipping_packaging_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.version,NEW.product_id,NEW.profile) IS DISTINCT FROM ROW(OLD.id,OLD.version,OLD.product_id,OLD.profile) THEN
    RAISE EXCEPTION 'Packaging revisions are immutable; insert a new version';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shipping_packaging_immutable_revision BEFORE UPDATE ON shipping_packaging_profiles
FOR EACH ROW EXECUTE FUNCTION protect_shipping_packaging_revision();

-- Existing rows are preserved. Retire a rate via status; insert a new version for pricing changes.
CREATE OR REPLACE FUNCTION protect_shipping_rate_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.zone_id, NEW.shipping_method_id, NEW.country_code, NEW.rate_minor, NEW.currency,
         NEW.minimum_order_minor, NEW.maximum_order_minor, NEW.minimum_weight_grams,
         NEW.maximum_weight_grams, NEW.free_shipping_threshold_minor, NEW.effective_from,
         NEW.effective_to, NEW.version, NEW.carrier_tariff)
     IS DISTINCT FROM
     ROW(OLD.zone_id, OLD.shipping_method_id, OLD.country_code, OLD.rate_minor, OLD.currency,
         OLD.minimum_order_minor, OLD.maximum_order_minor, OLD.minimum_weight_grams,
         OLD.maximum_weight_grams, OLD.free_shipping_threshold_minor, OLD.effective_from,
         OLD.effective_to, OLD.version, OLD.carrier_tariff) THEN
    RAISE EXCEPTION 'Shipping pricing revisions are immutable; insert a new version';
  END IF;
  RETURN NEW;
END;
$$;
