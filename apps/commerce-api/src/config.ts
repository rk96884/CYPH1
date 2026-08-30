export type PaymentProviderKey = "disabled" | "mollie-test";
export type FulfilmentMode = "disabled" | "test";
export type FulfilmentProviderKey = "disabled" | "manual-test";

export type CommerceConfig = Readonly<{
  commerceEnabled: boolean;
  paymentProvider: PaymentProviderKey;
  fulfilmentMode: FulfilmentMode;
  fulfilmentProvider: FulfilmentProviderKey;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

const isPaymentProvider = (value: string): value is PaymentProviderKey =>
  value === "disabled" || value === "mollie-test";

const isFulfilmentMode = (value: string): value is FulfilmentMode =>
  value === "disabled" || value === "test";

const isFulfilmentProvider = (value: string): value is FulfilmentProviderKey =>
  value === "disabled" || value === "manual-test";

export const loadCommerceConfig = (environment: Environment): CommerceConfig => {
  const paymentProvider = environment.PAYMENT_PROVIDER ?? "disabled";
  const fulfilmentMode = environment.FULFILMENT_MODE ?? "disabled";
  const fulfilmentProvider = environment.FULFILMENT_PROVIDER ?? "disabled";

  if (!isPaymentProvider(paymentProvider)) {
    throw new Error("Unsupported PAYMENT_PROVIDER configuration.");
  }

  if (!isFulfilmentMode(fulfilmentMode)) {
    throw new Error("Unsupported FULFILMENT_MODE configuration.");
  }
  if (!isFulfilmentProvider(fulfilmentProvider)) throw new Error("Unsupported FULFILMENT_PROVIDER configuration.");
  if (fulfilmentProvider === "manual-test" && fulfilmentMode !== "test") {
    throw new Error("The manual-test fulfilment provider is restricted to test mode.");
  }

  const requestedEnabled = environment.COMMERCE_ENABLED === "true";
  const dependenciesEnabled =
    paymentProvider !== "disabled" && fulfilmentMode !== "disabled" && fulfilmentProvider !== "disabled";

  return Object.freeze({
    commerceEnabled: requestedEnabled && dependenciesEnabled,
    paymentProvider,
    fulfilmentMode,
    fulfilmentProvider,
  });
};
