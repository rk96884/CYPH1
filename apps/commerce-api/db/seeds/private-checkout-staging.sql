INSERT INTO shipping_zones (id, zone_key, name, status)
VALUES (
  '00000000-0000-4000-8000-000000000701',
  'integration-test-uk',
  'INTEGRATION TEST UK — NOT FOR SALE',
  'test'
)
ON CONFLICT (id) DO UPDATE SET
  zone_key = EXCLUDED.zone_key,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO shipping_zone_countries (country_code, zone_id, destination_status)
VALUES ('GB', '00000000-0000-4000-8000-000000000701', 'test')
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO shipping_methods (id, method_key, name, description, status)
VALUES (
  '00000000-0000-4000-8000-000000000702',
  'manual-integration-test',
  'INTEGRATION TEST DELIVERY',
  'Synthetic delivery method for a private Mollie sandbox rehearsal only.',
  'test'
)
ON CONFLICT (id) DO UPDATE SET
  method_key = EXCLUDED.method_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO products (
  id, sku, slug, name, description, status, price_minor, currency, tax_code,
  fulfilment_sku, shipping_weight_grams, content_version
)
VALUES (
  '00000000-0000-4000-8000-000000000704',
  'INTEGRATION-TEST-NOT-FOR-SALE',
  'integration-test-fixture',
  'INTEGRATION TEST FIXTURE — NOT FOR SALE',
  'Synthetic private record for a controlled Mollie sandbox checkout rehearsal.',
  'private',
  100,
  'GBP',
  'TEST-ONLY-NOT-A-TAX-DECISION',
  'INTEGRATION-TEST-NOT-FOR-FULFILMENT',
  1,
  'private-checkout-staging-v1'
)
ON CONFLICT (id) DO UPDATE SET
  sku = EXCLUDED.sku,
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  price_minor = EXCLUDED.price_minor,
  currency = EXCLUDED.currency,
  tax_code = EXCLUDED.tax_code,
  fulfilment_sku = EXCLUDED.fulfilment_sku,
  shipping_weight_grams = EXCLUDED.shipping_weight_grams,
  content_version = EXCLUDED.content_version,
  updated_at = now();

INSERT INTO inventory_levels (
  id, product_id, location_key, available_quantity, reserved_quantity,
  safety_stock, source, source_updated_at
)
VALUES (
  '00000000-0000-4000-8000-000000000705',
  '00000000-0000-4000-8000-000000000704',
  'integration-test-only',
  10,
  0,
  0,
  'synthetic-private-checkout-staging-seed',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  location_key = EXCLUDED.location_key,
  available_quantity = EXCLUDED.available_quantity,
  reserved_quantity = EXCLUDED.reserved_quantity,
  safety_stock = EXCLUDED.safety_stock,
  source = EXCLUDED.source,
  source_updated_at = EXCLUDED.source_updated_at,
  updated_at = now();

INSERT INTO shipping_rates (
  id, zone_id, shipping_method_id, country_code, rate_minor, currency,
  minimum_order_minor, maximum_order_minor, minimum_weight_grams,
  maximum_weight_grams, free_shipping_threshold_minor, status,
  effective_from, effective_to, version
)
VALUES (
  '00000000-0000-4000-8000-000000000703',
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000702',
  'GB',
  100,
  'GBP',
  100,
  1000,
  1,
  1000,
  NULL,
  'test',
  '2026-01-01T00:00:00Z',
  NULL,
  1
)
ON CONFLICT (id) DO UPDATE SET
  zone_id = EXCLUDED.zone_id,
  shipping_method_id = EXCLUDED.shipping_method_id,
  country_code = EXCLUDED.country_code,
  rate_minor = EXCLUDED.rate_minor,
  currency = EXCLUDED.currency,
  minimum_order_minor = EXCLUDED.minimum_order_minor,
  maximum_order_minor = EXCLUDED.maximum_order_minor,
  minimum_weight_grams = EXCLUDED.minimum_weight_grams,
  maximum_weight_grams = EXCLUDED.maximum_weight_grams,
  free_shipping_threshold_minor = EXCLUDED.free_shipping_threshold_minor,
  status = EXCLUDED.status,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  version = EXCLUDED.version,
  updated_at = now();
