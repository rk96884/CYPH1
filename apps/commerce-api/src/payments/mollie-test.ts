import {
  PaymentProviderError, money, type CaptureInput, type CheckoutSession, type CreateCheckoutInput,
  type GetPaymentInput, type NormalisedCapture, type NormalisedPayment, type NormalisedRefund,
  type PaymentProvider, type PaymentStatus, type RefundInput, type VerifiedWebhook,
  type VerifyWebhookInput, type PaymentEvent,
} from "../../../../packages/commerce-core/src/index.js";
import { providerTimestamp } from "./capture-deadline.js";
import type { CaptureList, CaptureReplayEvidence } from "../../../../packages/commerce-core/src/index.js";
import { mollieCaptureContext, mollieCaptureReplaySafe } from "./mollie-capture-replay.js";

type Fetch = typeof globalThis.fetch;
type MollieAmount = { currency: string; value: string };
type MolliePayment = {
  id: string; status: string; createdAt: string; expiresAt?: string | null; captureBefore?: string | null;
  authorizedAt?: string | null; paidAt?: string | null; canceledAt?: string | null; expiredAt?: string | null;
  captureMode?: "manual" | "automatic" | null;
  amount: MollieAmount; amountRefunded?: MollieAmount; amountRemaining?: MollieAmount;
  metadata?: { orderId?: string; orderNumber?: string; correlationId?: string };
  _links?: { checkout?: { href?: string } };
};
type MollieCapture = { id: string; paymentId?: string; status?: string; amount: MollieAmount; createdAt: string };
type MollieCaptureList = { count: number; _embedded: { captures: (MollieCapture & { paymentId: string })[] }; _links: { next: { href: string } | null } };
type MollieRefund = { id: string; status: string; amount: MollieAmount; createdAt: string };
type MollieRefundList = { _embedded?: { refunds?: MollieRefund[] } };
type MollieWebhookPayload = { payment: MolliePayment; refunds: readonly MollieRefund[] };

const mollieTimestamp = (field: string, value: string | null | undefined): string | undefined => {
  try { return providerTimestamp(value); }
  catch (error) {
    if (error instanceof Error && error.message === "invalid_provider_timestamp") throw new Error(`invalid_provider_timestamp:${field}`);
    throw error;
  }
};

const captureMetadata = (payment: MolliePayment) => {
  const captureBefore = mollieTimestamp("captureBefore", payment.captureBefore);
  const authorisedAt = mollieTimestamp("authorizedAt", payment.authorizedAt);
  if (payment.captureMode != null && !["manual", "automatic"].includes(payment.captureMode)) throw new PaymentProviderError("unknown_provider_error", "Invalid capture mode.");
  return { ...(captureBefore ? { captureBefore } : {}), ...(authorisedAt ? { authorisedAt } : {}), ...(payment.captureMode ? { captureMode: payment.captureMode } : {}) };
};

export type MollieTestAdapterConfig = Readonly<{
  clock?: () => Date;
  apiKey: string;
  allowedCallbackOrigins: readonly string[];
  fetch?: Fetch;
  apiBaseUrl?: string;
  requestTimeoutMs?: number;
}>;

const requireText = (value: string, field: string): string => {
  const result = value.trim();
  if (!result) throw new PaymentProviderError("validation_error", `${field} is required.`);
  return result;
};

const formatAmount = (value: number): string => (value / 100).toFixed(2);

const parseAmount = (amount: MollieAmount) => {
  if (!/^\d+\.\d{2}$/.test(amount.value)) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an invalid amount.");
  return money(Number(amount.value.replace(".", "")), amount.currency);
};

const paymentStatus = (status: string): PaymentStatus => {
  const statuses: Record<string, PaymentStatus> = {
    open: "pending", pending: "pending", authorized: "authorised", paid: "captured",
    failed: "failed", canceled: "cancelled", expired: "expired",
  };
  const normalised = statuses[status];
  if (!normalised) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an unsupported payment status.");
  return normalised;
};

const refundStatus = (status: string): NormalisedRefund["status"] => {
  if (["queued", "pending", "processing"].includes(status)) return "pending";
  if (status === "refunded") return "completed";
  if (["failed", "canceled"].includes(status)) return "failed";
  throw new PaymentProviderError("unknown_provider_error", "Mollie returned an unsupported refund status.");
};

const webhookEventType = (status: string): PaymentEvent["type"] => {
  const events: Record<string, PaymentEvent["type"]> = {
    open: "payment.pending", pending: "payment.pending", authorized: "payment.authorised",
    paid: "payment.paid", failed: "payment.failed", canceled: "payment.cancelled", expired: "payment.expired",
  };
  const event = events[status];
  if (!event) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an unsupported webhook status.");
  return event;
};

const providerError = (status: number): PaymentProviderError => {
  if (status === 401 || status === 403) return new PaymentProviderError("authentication_error", "Mollie authentication failed.");
  if (status === 404) return new PaymentProviderError("not_found", "The Mollie resource was not found.");
  if (status === 409) return new PaymentProviderError("conflict", "Mollie reported a conflicting request.", true);
  if (status === 400 || status === 422) return new PaymentProviderError("validation_error", "Mollie rejected the request.");
  if (status === 429) return new PaymentProviderError("rate_limited", "Mollie rate-limited the request.", true);
  if (status >= 500) return new PaymentProviderError("provider_unavailable", "Mollie is temporarily unavailable.", true);
  return new PaymentProviderError("unknown_provider_error", "Mollie returned an unexpected response.");
};

export class MollieTestPaymentProvider implements PaymentProvider {
  readonly key = "mollie-test";
  readonly #fetch: Fetch;
  readonly #apiBaseUrl: string;
  readonly #allowedOrigins: ReadonlySet<string>;
  readonly #requestTimeoutMs: number;

  constructor(readonly config: MollieTestAdapterConfig) {
    if (!config.apiKey.startsWith("test_") || config.apiKey.length < 10) throw new PaymentProviderError("configuration_error", "Mollie test adapter requires a test API key.");
    this.#fetch = config.fetch ?? globalThis.fetch;
    this.#apiBaseUrl = (config.apiBaseUrl ?? "https://api.mollie.com/v2").replace(/\/$/, "");
    this.#allowedOrigins = new Set(config.allowedCallbackOrigins.map((origin) => new URL(origin).origin));
    this.#requestTimeoutMs = config.requestTimeoutMs ?? 10_000;
    if (!Number.isSafeInteger(this.#requestTimeoutMs) || this.#requestTimeoutMs < 1 || this.#requestTimeoutMs > 30_000) throw new PaymentProviderError("configuration_error", "Mollie request timeout must be between 1 and 30000 milliseconds.");
    if (this.#allowedOrigins.size === 0) throw new PaymentProviderError("configuration_error", "At least one callback origin is required.");
  }

  #callbackUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== "https:" || !this.#allowedOrigins.has(url.origin)) throw new PaymentProviderError("validation_error", "Callback URL is not an approved HTTPS origin.");
    return url.href;
  }

  async #request<Result>(path: string, init: RequestInit, correlationId: string): Promise<Result> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      response = await this.#fetch(`${this.#apiBaseUrl}${path}`, { ...init, signal: controller.signal, headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", "X-CYPH1-Correlation-ID": correlationId, ...(init.headers ?? {}) } });
    } catch { throw new PaymentProviderError("network_error", "Mollie could not be reached.", true); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw providerError(response.status);
    try { return await response.json() as Result; }
    catch { throw new PaymentProviderError("unknown_provider_error", "Mollie returned malformed JSON."); }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    requireText(input.orderId, "Order ID"); requireText(input.orderNumber, "Order number"); requireText(input.idempotencyKey, "Idempotency key"); requireText(input.correlationId, "Correlation ID");
    if (input.amount.currency !== "GBP" || input.amount.value <= 0) throw new PaymentProviderError("validation_error", "Mollie checkout requires a positive GBP total.");
    if (input.lines.length === 0) throw new PaymentProviderError("validation_error", "Checkout lines are required.");
    const lineTotal = input.lines.reduce((sum, line) => {
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !line.description.trim()) throw new PaymentProviderError("validation_error", "Checkout lines require a description and positive quantity.");
      if (line.unitPrice.currency !== input.amount.currency || line.totalAmount.currency !== input.amount.currency || line.unitPrice.value * line.quantity !== line.totalAmount.value) throw new PaymentProviderError("validation_error", "Checkout line totals must match quantity, unit price and currency.");
      return sum + line.totalAmount.value;
    }, 0);
    if (lineTotal !== input.amount.value) throw new PaymentProviderError("validation_error", "Checkout lines must equal the authoritative order total.");
    if (input.method === "klarna") {
      if (input.captureMode !== "manual") throw new PaymentProviderError("validation_error", "Klarna checkout requires manual capture.");
      const c = input.customer;
      if (!c?.email || !c.givenName || !c.familyName || !c.streetAndNumber || !c.postalCode || !c.city || !c.country) throw new PaymentProviderError("validation_error", "Klarna checkout requires complete billing details.");
    }
    const payment = await this.#request<MolliePayment>("/payments", {
      method: "POST", headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        amount: { currency: input.amount.currency, value: formatAmount(input.amount.value) }, description: `CYPH/1 order ${input.orderNumber}`,
        redirectUrl: this.#callbackUrl(input.successUrl), cancelUrl: this.#callbackUrl(input.cancellationUrl), webhookUrl: this.#callbackUrl(input.webhookUrl),
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber, correlationId: input.correlationId },
        lines: input.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPrice: { currency: line.unitPrice.currency, value: formatAmount(line.unitPrice.value) }, totalAmount: { currency: line.totalAmount.currency, value: formatAmount(line.totalAmount.value) } })),
        ...(input.method ? { method: input.method } : {}), ...(input.captureMode ? { captureMode: input.captureMode } : {}),
        ...(input.customer ? { billingAddress: input.customer } : {}), ...(input.shippingAddress ? { shippingAddress: input.shippingAddress } : {}),
      }),
    }, input.correlationId);
    const checkoutUrl = payment._links?.checkout?.href;
    if (!checkoutUrl) throw new PaymentProviderError("unknown_provider_error", "Mollie did not return a checkout URL.");
    const checkout = new URL(checkoutUrl);
    if (checkout.protocol !== "https:" || !(checkout.hostname === "mollie.com" || checkout.hostname.endsWith(".mollie.com"))) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an untrusted checkout URL.");
    return Object.freeze({ provider: this.key, providerPaymentId: payment.id, checkoutUrl: checkout.href, status: paymentStatus(payment.status), ...(payment.expiresAt ? { expiresAt: payment.expiresAt } : {}), ...captureMetadata(payment), metadata: Object.freeze({ orderId: input.orderId, correlationId: input.correlationId }) });
  }

  async getPayment(input: GetPaymentInput): Promise<NormalisedPayment> {
    const payment = await this.#request<MolliePayment>(`/payments/${encodeURIComponent(requireText(input.providerPaymentId, "Provider payment ID"))}`, { method: "GET" }, requireText(input.correlationId, "Correlation ID"));
    const amount = parseAmount(payment.amount); const refunded = payment.amountRefunded ? parseAmount(payment.amountRefunded) : money(0, amount.currency);
    if (refunded.currency !== amount.currency || refunded.value > amount.value) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an invalid refunded amount.");
    let refundableAmount = money(amount.value - refunded.value, amount.currency);
    if (payment.amountRemaining !== undefined) {
      try { refundableAmount = parseAmount(payment.amountRemaining); }
      catch { throw new PaymentProviderError("unknown_provider_error", "Mollie returned an invalid remaining amount."); }
      if (refundableAmount.currency !== amount.currency || refundableAmount.value > amount.value) throw new PaymentProviderError("unknown_provider_error", "Mollie returned an invalid remaining amount.");
    }
    return Object.freeze({ provider: this.key, providerPaymentId: payment.id, ...(payment.metadata?.orderId ? { orderId: payment.metadata.orderId } : {}), status: paymentStatus(payment.status), amount, refundableAmount, createdAt: payment.createdAt, ...captureMetadata(payment), ...(payment.paidAt ? { paidAt: payment.paidAt } : {}), ...(payment.canceledAt ? { cancelledAt: payment.canceledAt } : {}), ...(payment.expiredAt ? { expiredAt: payment.expiredAt } : {}) });
  }

  async capture(input: CaptureInput): Promise<NormalisedCapture> {
    if (input.replay && !this.canReplayCapture(input.replay, this.config.clock?.() ?? new Date())) throw new PaymentProviderError("conflict", "Capture replay is not demonstrably safe.");
    if (input.amount.currency !== input.authorisedAmount.currency || input.amount.value <= 0 || input.amount.value > input.authorisedAmount.value) throw new PaymentProviderError("validation_error", "Capture amount exceeds the authoritative authorised amount.");
    const capture = await this.#request<MollieCapture>(`/payments/${encodeURIComponent(requireText(input.providerPaymentId, "Provider payment ID"))}/captures`, {
      method: "POST", headers: { "Idempotency-Key": requireText(input.idempotencyKey, "Idempotency key") },
      body: JSON.stringify({ amount: { currency: input.amount.currency, value: formatAmount(input.amount.value) }, description: `CYPH/1 order ${input.orderId}`, metadata: { orderId: input.orderId, operatorId: input.operatorId } }),
    }, requireText(input.correlationId, "Correlation ID"));
    if (!/^cpt_[A-Za-z0-9]+$/.test(capture.id) || (capture.paymentId !== undefined && capture.paymentId !== input.providerPaymentId) || !["pending", "succeeded", "failed"].includes(capture.status ?? "") || !providerTimestamp(capture.createdAt)) throw new PaymentProviderError("unknown_provider_error", "Invalid capture response.");
    return Object.freeze({ provider: this.key, providerPaymentId: input.providerPaymentId, providerCaptureId: capture.id, amount: parseAmount(capture.amount), status: capture.status === "failed" ? "failed" : capture.status === "succeeded" ? "completed" : "pending", createdAt: capture.createdAt });
  }

  captureReplayContext(): string { return mollieCaptureContext(this.config.apiKey, this.config.apiBaseUrl); }
  canReplayCapture(evidence: CaptureReplayEvidence, now: Date): boolean { return mollieCaptureReplaySafe(evidence, this.captureReplayContext(), now); }

  async listCaptures(input: GetPaymentInput): Promise<CaptureList> {
    const list = await this.#request<MollieCaptureList>(`/payments/${encodeURIComponent(requireText(input.providerPaymentId, "Provider payment ID"))}/captures?limit=250`, { method: "GET" }, input.correlationId);
    if (!Array.isArray(list._embedded?.captures) || list.count !== list._embedded.captures.length || !list._links || !("next" in list._links)) throw new PaymentProviderError("unknown_provider_error", "Incomplete capture lookup.");
    const captures = list._embedded.captures.map((capture): NormalisedCapture => {
      if (!/^cpt_[A-Za-z0-9]+$/.test(capture.id) || capture.paymentId !== input.providerPaymentId || !["pending", "succeeded", "failed"].includes(capture.status ?? "") || !providerTimestamp(capture.createdAt)) throw new PaymentProviderError("unknown_provider_error", "Invalid capture lookup.");
      return { provider: this.key, providerPaymentId: capture.paymentId, providerCaptureId: capture.id, amount: parseAmount(capture.amount), status: capture.status === "succeeded" ? "completed" : capture.status === "failed" ? "failed" : "pending", createdAt: providerTimestamp(capture.createdAt)! };
    });
    if (new Set(captures.map((capture) => capture.providerCaptureId)).size !== captures.length) throw new PaymentProviderError("unknown_provider_error", "Duplicate capture lookup.");
    // A truncated list is evidence of ambiguity, never evidence of no captures.
    return { captures, complete: list._links.next === null };
  }

  async refund(input: RefundInput): Promise<NormalisedRefund> {
    if (input.amount.currency !== input.refundableAmount.currency || input.amount.value <= 0 || input.amount.value > input.refundableAmount.value) throw new PaymentProviderError("validation_error", "Refund amount exceeds the authoritative refundable amount.");
    const refund = await this.#request<MollieRefund>(`/payments/${encodeURIComponent(requireText(input.providerPaymentId, "Provider payment ID"))}/refunds`, { method: "POST", headers: { "Idempotency-Key": requireText(input.idempotencyKey, "Idempotency key") }, body: JSON.stringify({ amount: { currency: input.amount.currency, value: formatAmount(input.amount.value) }, description: input.reason, metadata: { orderId: input.orderId, paymentId: input.paymentId, operatorId: input.operatorId } }) }, requireText(input.correlationId, "Correlation ID"));
    return Object.freeze({ provider: this.key, providerPaymentId: input.providerPaymentId, providerRefundId: refund.id, amount: parseAmount(refund.amount), status: refundStatus(refund.status), createdAt: refund.createdAt });
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook> {
    let endpoint: URL; try { endpoint = new URL(input.endpointUrl); } catch { return Object.freeze({ outcome: "malformed", provider: this.key }); }
    if (endpoint.protocol !== "https:" || !this.#allowedOrigins.has(endpoint.origin)) return Object.freeze({ outcome: "invalid", provider: this.key });
    const contentType = Object.entries(input.headers).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? "";
    if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded") || input.rawBody.byteLength === 0 || input.rawBody.byteLength > 1024) return Object.freeze({ outcome: "malformed", provider: this.key });
    let body: string; try { body = new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody); } catch { return Object.freeze({ outcome: "malformed", provider: this.key }); }
    const parameters = new URLSearchParams(body);
    if ([...parameters.keys()].some((key) => key !== "id") || parameters.getAll("id").length !== 1) return Object.freeze({ outcome: "malformed", provider: this.key });
    const paymentId = parameters.get("id") ?? ""; if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) return Object.freeze({ outcome: "malformed", provider: this.key });
    let payment: MolliePayment;
    try { payment = await this.#request<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" }, "webhook-authentication"); }
    catch (error) { if (error instanceof PaymentProviderError && error.category === "not_found") return Object.freeze({ outcome: "irrelevant", provider: this.key, providerEventId: `unknown:${paymentId}` }); throw error; }
    if (payment.id !== paymentId) return Object.freeze({ outcome: "invalid", provider: this.key });
    const refundList = await this.#request<MollieRefundList>(`/payments/${encodeURIComponent(paymentId)}/refunds`, { method: "GET" }, "webhook-authentication");
    const refunds = refundList._embedded?.refunds ?? []; const refundFingerprint = refunds.map((refund) => `${refund.id}:${refund.status}`).sort().join(",") || "none";
    return Object.freeze({ outcome: "actionable", provider: this.key, providerEventId: `payment:${payment.id}:${payment.status}:refunds:${refundFingerprint}`, payload: Object.freeze({ payment, refunds: Object.freeze(refunds) } satisfies MollieWebhookPayload) });
  }

  async normaliseWebhook(input: VerifiedWebhook): Promise<readonly PaymentEvent[]> {
    if (input.provider !== this.key || input.outcome !== "actionable" || !input.providerEventId || !input.payload) return Object.freeze([]);
    const payload = input.payload as MollieWebhookPayload; const payment = payload.payment;
    if (!payment?.id || !payment.status || !payment.createdAt || !payment.amount || !Array.isArray(payload.refunds)) throw new PaymentProviderError("unknown_provider_error", "Verified Mollie webhook payload is incomplete.");
    const occurredAt = payment.paidAt ?? payment.authorizedAt ?? payment.canceledAt ?? payment.expiredAt ?? payment.createdAt;
    const timing = captureMetadata(payment);
    const revision = payment.status === "authorized" ? `:${timing.captureMode ?? "unknown"}:${timing.captureBefore ?? "missing"}:${timing.authorisedAt ?? "missing"}` : "";
    const paymentEvent = Object.freeze({ eventId: `payment:${payment.id}:${payment.status}${revision}`, provider: this.key, providerPaymentId: payment.id, type: webhookEventType(payment.status), occurredAt, amount: parseAmount(payment.amount), ...timing } satisfies PaymentEvent);
    const refundEvents = payload.refunds.map((refund) => Object.freeze({ eventId: `refund:${refund.id}:${refund.status}`, provider: this.key, providerPaymentId: payment.id, providerRefundId: refund.id, type: (`refund.${refundStatus(refund.status)}`) as PaymentEvent["type"], occurredAt: refund.createdAt, amount: parseAmount(refund.amount) } satisfies PaymentEvent));
    return Object.freeze([paymentEvent, ...refundEvents]);
  }
}
