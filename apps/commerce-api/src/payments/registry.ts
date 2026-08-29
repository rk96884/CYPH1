import { PaymentProviderError, type PaymentProvider, type PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";

export class ConfiguredPaymentProviderRegistry implements PaymentProviderRegistry {
  readonly #providers: ReadonlyMap<string, PaymentProvider>;

  constructor(providers: readonly PaymentProvider[], readonly configuredProviderKey: string) {
    const entries = providers.map((provider) => [provider.key, provider] as const);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) {
      throw new PaymentProviderError("configuration_error", "Payment provider keys must be unique.");
    }
    this.#providers = new Map(entries);
  }

  getConfiguredProvider(): PaymentProvider {
    return this.getProvider(this.configuredProviderKey);
  }

  getProvider(providerKey: string): PaymentProvider {
    const provider = this.#providers.get(providerKey);
    if (!provider) throw new PaymentProviderError("configuration_error", "The requested payment provider is not configured.");
    return provider;
  }
}
