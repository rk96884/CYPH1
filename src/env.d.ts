/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_COMMERCE_UI_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
