import { features } from "./features";

export type PrivateCommercePresentation = Readonly<{
  productSlug: string;
  productName: string;
  apiUrl: string;
  shippingRateId: string;
}>;

const text = (value: string | undefined): string | undefined => {
  const result = value?.trim();
  return result || undefined;
};

/**
 * Presentation only. The commerce API independently enforces its server-side
 * COMMERCE_ENABLED, provider and fulfilment gates.
 */
export const privateCommercePresentation = (): PrivateCommercePresentation | undefined => {
  if (!features.commerceUi) return undefined;
  const productSlug = text(import.meta.env.PUBLIC_COMMERCE_TEST_PRODUCT_SLUG);
  const productName = text(import.meta.env.PUBLIC_COMMERCE_TEST_PRODUCT_NAME);
  const apiUrl = text(import.meta.env.PUBLIC_COMMERCE_API_URL);
  const shippingRateId = text(import.meta.env.PUBLIC_COMMERCE_TEST_SHIPPING_RATE_ID);
  if (!productSlug || !productName || !apiUrl || !shippingRateId) {
    throw new Error("Private commerce UI requires explicit test product and API presentation settings.");
  }
  const endpoint = new URL(apiUrl);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
    throw new Error("Private commerce API must use HTTPS outside local development.");
  }
  return Object.freeze({ productSlug, productName, apiUrl: endpoint.href.replace(/\/$/, ""), shippingRateId });
};
