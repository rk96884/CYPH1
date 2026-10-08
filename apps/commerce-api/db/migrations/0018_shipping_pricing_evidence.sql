-- Existing rows are preserved. Retire a rate via status; insert a new version for pricing changes.
CREATE FUNCTION protect_shipping_rate_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.zone_id, NEW.shipping_method_id, NEW.country_code, NEW.rate_minor, NEW.currency,
         NEW.minimum_order_minor, NEW.maximum_order_minor, NEW.minimum_weight_grams,
         NEW.maximum_weight_grams, NEW.free_shipping_threshold_minor, NEW.effective_from,
         NEW.effective_to, NEW.version)
     IS DISTINCT FROM
     ROW(OLD.zone_id, OLD.shipping_method_id, OLD.country_code, OLD.rate_minor, OLD.currency,
         OLD.minimum_order_minor, OLD.maximum_order_minor, OLD.minimum_weight_grams,
         OLD.maximum_weight_grams, OLD.free_shipping_threshold_minor, OLD.effective_from,
         OLD.effective_to, OLD.version) THEN
    RAISE EXCEPTION 'Shipping pricing revisions are immutable; insert a new version';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER shipping_rates_immutable_revision BEFORE UPDATE ON shipping_rates
FOR EACH ROW EXECUTE FUNCTION protect_shipping_rate_revision();

CREATE FUNCTION protect_order_shipping_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.shipping_rate_id, NEW.shipping_country_code, NEW.shipping_method_snapshot,
         NEW.shipping_rate_snapshot, NEW.delivery_minor)
     IS DISTINCT FROM
     ROW(OLD.shipping_rate_id, OLD.shipping_country_code, OLD.shipping_method_snapshot,
         OLD.shipping_rate_snapshot, OLD.delivery_minor) THEN
    RAISE EXCEPTION 'Order shipping pricing evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_immutable_shipping_evidence BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION protect_order_shipping_evidence();
