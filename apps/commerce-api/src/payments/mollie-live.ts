import {
  PaymentProviderError, type CaptureInput, type CheckoutSession, type CreateCheckoutInput,
  type GetPaymentInput, type NormalisedCapture, type NormalisedPayment, type NormalisedRefund,
  type PaymentProvider, type RefundInput, type VerifiedWebhook,
  type VerifyWebhookInput, type PaymentEvent,
} from "../../../../packages/commerce-core/src/index.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";
import type { CaptureList, CaptureReplayEvidence } from "../../../../packages/commerce-core/src/index.js";
import { mollieCaptureContext, mollieCaptureReplaySafe } from "./mollie-capture-replay.js";

type Fetch = typeof globalThis.fetch;

export type MollieLiveAdapterConfig = Readonly<{
  clock?: () => Date;
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

  async capture(input: CaptureInput): Promise<NormalisedCapture> {
    if (input.replay && !this.canReplayCapture(input.replay, this.config.clock?.() ?? new Date())) throw new PaymentProviderError("conflict", "Capture replay is not demonstrably safe.");
    // The live credential was checked above, not the delegate's synthetic credential.
    const { replay: _replay, ...request } = input;
    const result = await this.#delegate.capture(request);
    return Object.freeze({ ...result, provider: this.key });
  }

  captureReplayContext(): string { return mollieCaptureContext(this.config.apiKey, this.config.apiBaseUrl); }
  canReplayCapture(evidence: CaptureReplayEvidence, now: Date): boolean { return mollieCaptureReplaySafe(evidence, this.captureReplayContext(), now); }
  async listCaptures(input: GetPaymentInput): Promise<CaptureList> {
    const result = await this.#delegate.listCaptures(input);
    return { ...result, captures: result.captures.map((capture) => ({ ...capture, provider: this.key })) };
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
