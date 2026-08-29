-- Non-production fixture. It is private and therefore cannot be purchased.
INSERT INTO products (
  sku, slug, name, description, status, price_minor, currency, tax_code, shipping_weight_grams, content_version
) VALUES (
  'DEV-NOT-FOR-SALE',
  'development-fixture-not-for-sale',
  'DEVELOPMENT FIXTURE — NOT FOR SALE',
  'Non-production database verification record. Not a CYPH/1 product.',
  'private',
  0,
  'GBP',
  'UNAPPROVED-DEVELOPMENT-ONLY',
  1,
  'development-fixture-v1'
)
ON CONFLICT (sku) DO NOTHING;
