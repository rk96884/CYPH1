/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_COMMERCE_UI_ENABLED?: string;
  readonly PUBLIC_COMMERCE_TEST_PRODUCT_SLUG?: string;
  readonly PUBLIC_COMMERCE_TEST_PRODUCT_NAME?: string;
  readonly PUBLIC_COMMERCE_API_URL?: string;
  readonly PUBLIC_COMMERCE_TEST_SHIPPING_RATE_ID?: string;
  readonly PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED?: string;
  readonly PUBLIC_COMMERCE_OPERATIONS_SLUG?: string;
  readonly PUBLIC_COMMERCE_OPERATIONS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
