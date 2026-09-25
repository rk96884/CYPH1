import { PaymentProviderError } from "../../../../packages/commerce-core/src/index.js";
import { loadCommerceConfig } from "../config.js";
import { MollieLivePaymentProvider } from "./mollie-live.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";
import { ConfiguredPaymentProviderRegistry } from "./registry.js";

type Environment = Readonly<Record<string, string | undefined>>;

export const createPaymentProviderRegistry = (environment: Environment): ConfiguredPaymentProviderRegistry => {
  const commerce = loadCommerceConfig(environment);
  if (commerce.paymentProvider === "disabled") {
    return new ConfiguredPaymentProviderRegistry([], "disabled");
  }
  const apiKey = environment.MOLLIE_API_KEY;
  const origins = environment.PAYMENT_CALLBACK_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (!apiKey || origins.length === 0) {
    throw new PaymentProviderError("configuration_error", "Mollie configuration requires an API key and approved callback origins.");
  }
  const provider = commerce.paymentProvider === "mollie-live"
    ? new MollieLivePaymentProvider({ apiKey, allowedCallbackOrigins: origins })
    : new MollieTestPaymentProvider({ apiKey, allowedCallbackOrigins: origins });
  return new ConfiguredPaymentProviderRegistry([provider], commerce.paymentProvider);
};