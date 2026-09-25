import {
  PaymentProviderError, type CheckoutSession, type CreateCheckoutInput,
  type GetPaymentInput, type NormalisedPayment, type NormalisedRefund,
  type PaymentProvider, type RefundInput, type VerifiedWebhook,
  type VerifyWebhookInput, type PaymentEvent,
} from "../../../../packages/commerce-core/src/index.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";

type Fetch = typeof globalThis.fetch;

export type MollieLiveAdapterConfig = Readonly<{
  apiKey: string;
  allowedCallbackOrigins: readonly string[];
  fetch?: Fetch;
  apiBaseUrl?: string;
  requestTimeoutMs?: number;
}>;

/**
 * Production Mollie adapter. Reuses the battle-tested request/validation logic
 * in the test adapter while keeping live credentials and provider identity
 * explicitly separate. The delegated fetch replaces the synthetic test
 * credential before any request leaves the process.
 */
export class MollieLivePaymentProvider implements PaymentProvider {
  readonly key = "mollie-live";
  readonly #delegate: MollieTestPaymentProvider;

  constructor(readonly config: MollieLiveAdapterConfig) {
    if (!config.apiKey.startsWith("live_") || config.apiKey.length < 10) {
      throw new PaymentProviderError("configuration_error", "Mollie live adapter requires a live API key.");
    }
    const upstreamFetch = config.fetch ?? globalThis.fetch;
    const authenticatedFetch: Fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${config.apiKey}`);
      return upstreamFetch(input, { ...init, headers });
    };
    this.#delegate = new MollieTestPaymentProvider({
      apiKey: "test_live_adapter_internal_only",
      allowedCallbackOrigins: config.allowedCallbackOrigins,
      fetch: authenticatedFetch,
      ...(config.apiBaseUrl ? { apiBaseUrl: config.apiBaseUrl } : {}),
      ...(config.requestTimeoutMs ? { requestTimeoutMs: config.requestTimeoutMs } : {}),
    });
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const result = await this.#delegate.createCheckout(input);
    return Object.freeze({ ...result, provider: this.key });
  }

  async getPayment(input: GetPaymentInput): Promise<NormalisedPayment> {
    const result = await this.#delegate.getPayment(input);
    return Object.freeze({ ...result, provider: this.key });
  }

  async refund(input: RefundInput): Promise<NormalisedRefund> {
    const result = await this.#delegate.refund(input);
    return Object.freeze({ ...result, provider: this.key });
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
    const result = await this.#delegate.verifyWebhook(input);
    return Object.freeze({ ...result, provider: this.key });
  }

  async normaliseWebhook(input: VerifiedWebhook): Promise<readonly PaymentEvent[]> {
    const delegated = Object.freeze({ ...input, provider: "mollie-test" });
    const events = await this.#delegate.normaliseWebhook(delegated);
    return Object.freeze(events.map((event) => Object.freeze({ ...event, provider: this.key })));
  }
}
