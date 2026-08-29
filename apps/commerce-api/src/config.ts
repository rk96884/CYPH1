export type PaymentProviderKey = "disabled" | "mollie-test";
export type FulfilmentMode = "disabled" | "test";

export type CommerceConfig = Readonly<{
  commerceEnabled: boolean;
  paymentProvider: PaymentProviderKey;
  fulfilmentMode: FulfilmentMode;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

const isPaymentProvider = (value: string): value is PaymentProviderKey =>
  value === "disabled" || value === "mollie-test";

const isFulfilmentMode = (value: string): value is FulfilmentMode =>
  value === "disabled" || value === "test";

export const loadCommerceConfig = (environment: Environment): CommerceConfig => {
  const paymentProvider = environment.PAYMENT_PROVIDER ?? "disabled";
  const fulfilmentMode = environment.FULFILMENT_MODE ?? "disabled";

  if (!isPaymentProvider(paymentProvider)) {
    throw new Error("Unsupported PAYMENT_PROVIDER configuration.");
  }

  if (!isFulfilmentMode(fulfilmentMode)) {
    throw new Error("Unsupported FULFILMENT_MODE configuration.");
  }

  const requestedEnabled = environment.COMMERCE_ENABLED === "true";
  const dependenciesEnabled =
    paymentProvider !== "disabled" && fulfilmentMode !== "disabled";

  return Object.freeze({
    commerceEnabled: requestedEnabled && dependenciesEnabled,
    paymentProvider,
    fulfilmentMode,
  });
};
