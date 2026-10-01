import assert from "node:assert/strict";
import test from "node:test";
import { PaymentProviderError, money, type CreateCheckoutInput, type PaymentProvider } from "../../../../packages/commerce-core/src/index.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";
import { ConfiguredPaymentProviderRegistry } from "./registry.js";
import { createPaymentProviderRegistry } from "./factory.js";
import { loadCommerceConfig } from "../config.js";

const checkoutInput = (overrides: Partial<CreateCheckoutInput> = {}): CreateCheckoutInput => ({
  orderId: "order_1", orderNumber: "CYPH-0001", amount: money(12_000, "GBP"),
  lines: [{ description: "Approved product", quantity: 2, unitPrice: money(6_000, "GBP"), totalAmount: money(12_000, "GBP") }],
  successUrl: "https://checkout.cyph1.co.uk/orders/order_1", cancellationUrl: "https://checkout.cyph1.co.uk/orders/order_1/cancelled",
  webhookUrl: "https://api.cyph1.co.uk/webhooks/mollie", idempotencyKey: "idem-1", correlationId: "corr-1", ...overrides,
});

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("registry selects only server-configured providers", () => {
  const provider = { key: "mollie-test" } as PaymentProvider;
  const registry = new ConfiguredPaymentProviderRegistry([provider], "mollie-test");
  assert.equal(registry.getConfiguredProvider(), provider);
  assert.throws(() => registry.getProvider("browser-choice"), PaymentProviderError);
});

test("Mollie checkout sends authoritative totals, callbacks and idempotency key", async () => {
  let request: { url: string; init: RequestInit | undefined } | undefined;
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"],
    fetch: async (url, init) => {
      request = { url: String(url), init };
      return response({ id: "tr_1", status: "open", createdAt: "2026-08-29T12:00:00Z", expiresAt: "2026-08-29T12:15:00Z", amount: { currency: "GBP", value: "120.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/select-method/tr_1" } } }, 201);
    },
  });
  const result = await provider.createCheckout(checkoutInput());
  assert.equal(result.providerPaymentId, "tr_1");
  assert.equal(result.status, "pending");
  assert.equal(request?.url, "https://api.mollie.com/v2/payments");
  const headers = new Headers(request?.init?.headers);
  assert.equal(headers.get("Idempotency-Key"), "idem-1");
  assert.equal(headers.get("Authorization"), "Bearer test_example_key");
  const body = JSON.parse(String(request?.init?.body)) as { amount: { value: string }; metadata: { orderId: string }; redirectUrl: string };
  assert.equal(body.amount.value, "120.00");
  assert.equal(body.metadata.orderId, "order_1");
  assert.equal(body.redirectUrl, "https://checkout.cyph1.co.uk/orders/order_1");
});

test("Mollie checkout rejects total tampering and unapproved callback origins", async () => {
  const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"], fetch: async () => { throw new Error("must not call"); } });
  await assert.rejects(() => provider.createCheckout(checkoutInput({ amount: money(11_999, "GBP") })), (error: unknown) => error instanceof PaymentProviderError && error.category === "validation_error");
  await assert.rejects(() => provider.createCheckout(checkoutInput({ successUrl: "https://attacker.example/order" })), (error: unknown) => error instanceof PaymentProviderError && error.category === "validation_error");
});

test("Mollie checkout rejects an untrusted hosted URL", async () => {
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"],
    fetch: async () => response({ id: "tr_1", status: "open", createdAt: "2026-08-29T12:00:00Z", amount: { currency: "GBP", value: "120.00" }, _links: { checkout: { href: "https://mollie.example/steal" } } }, 201),
  });
  await assert.rejects(() => provider.createCheckout(checkoutInput()), /untrusted checkout URL/);
});

test("Mollie payment status and refundable amount are normalised", async () => {
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
    fetch: async () => response({ id: "tr_1", status: "paid", createdAt: "2026-08-29T12:00:00Z", paidAt: "2026-08-29T12:01:00Z", amount: { currency: "GBP", value: "120.00" }, amountRefunded: { currency: "GBP", value: "20.00" }, metadata: { orderId: "order_1" } }),
  });
  const result = await provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" });
  assert.equal(result.status, "captured");
  assert.equal(result.refundableAmount.value, 10_000);
  assert.equal(result.orderId, "order_1");
});

test("Mollie amountRemaining overrides the reconstructed refundable balance, including zero", async () => {
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
    fetch: async () => response({ id: "tr_1", status: "paid", createdAt: "2026-08-29T12:00:00Z", amount: { currency: "GBP", value: "2.00" }, amountRefunded: { currency: "GBP", value: "1.00" }, amountRemaining: { currency: "GBP", value: "0.00" } }),
  });
  const result = await provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" });
  assert.equal(result.refundableAmount.value, 0);
  assert.equal(result.refundableAmount.currency, "GBP");
});

for (const [name, amountRemaining] of [
  ["currency mismatch", { currency: "EUR", value: "1.00" }],
  ["above payment amount", { currency: "GBP", value: "2.01" }],
  ["negative", { currency: "GBP", value: "-1.00" }],
  ["malformed value", { currency: "GBP", value: "sensitive-provider-data" }],
  ["malformed currency", { currency: "sensitive-provider-data", value: "1.00" }],
  ["null", null],
] as const) {
  test(`Mollie rejects invalid amountRemaining: ${name}`, async () => {
    const provider = new MollieTestPaymentProvider({
      apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
      fetch: async () => response({ id: "tr_1", status: "paid", createdAt: "2026-08-29T12:00:00Z", amount: { currency: "GBP", value: "2.00" }, amountRefunded: { currency: "GBP", value: "1.00" }, amountRemaining }),
    });
    await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) =>
      error instanceof PaymentProviderError && error.category === "unknown_provider_error" && error.message === "Mollie returned an invalid remaining amount.");
  });
}

test("Mollie still validates amountRefunded when amountRemaining is present", async () => {
  for (const amountRefunded of [{ currency: "EUR", value: "1.00" }, { currency: "GBP", value: "2.01" }]) {
    const provider = new MollieTestPaymentProvider({
      apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
      fetch: async () => response({ id: "tr_1", status: "paid", createdAt: "2026-08-29T12:00:00Z", amount: { currency: "GBP", value: "2.00" }, amountRefunded, amountRemaining: { currency: "GBP", value: "0.00" } }),
    });
    await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) =>
      error instanceof PaymentProviderError && error.category === "unknown_provider_error" && error.message === "Mollie returned an invalid refunded amount.");
  }
});

test("Mollie refund rejects over-refunds before making a provider call", async () => {
  let calls = 0;
  const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], fetch: async () => { calls += 1; return response({}); } });
  await assert.rejects(() => provider.refund({
    paymentId: "pay_1", orderId: "order_1", providerPaymentId: "tr_1", amount: money(6_000, "GBP"), refundableAmount: money(5_000, "GBP"),
    reason: "customer_request", operatorId: "operator_1", idempotencyKey: "refund-1", correlationId: "corr-1",
  }), /exceeds/);
  assert.equal(calls, 0);
});

test("Mollie HTTP failures map to safe retry categories", async () => {
  const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], fetch: async () => response({ detail: "sensitive" }, 503) });
  await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) =>
    error instanceof PaymentProviderError && error.category === "provider_unavailable" && error.retryable && !error.message.includes("sensitive"));
});

test("Mollie structured errors retain only fixed safe diagnostics without changing HTTP mappings", async () => {
  for (const [status, category, retryable] of [
    [400, "validation_error", false], [401, "authentication_error", false], [403, "authentication_error", false],
    [404, "not_found", false], [409, "conflict", true], [422, "validation_error", false],
    [429, "rate_limited", true], [500, "provider_unavailable", true], [503, "provider_unavailable", true], [418, "unknown_provider_error", false],
  ] as const) {
    const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
      fetch: async () => response({ status, title: "Conflict", field: "amount", detail: "Authorization: Bearer test_example_key customer@example.test",
        code: "unverified-code", metadata: { private: true }, headers: { Authorization: "test_example_key" }, arbitrary: "raw-body", _links: { href: "private" } }, status) });
    await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) => {
      assert.ok(error instanceof PaymentProviderError);
      assert.equal(error.category, category); assert.equal(error.retryable, retryable);
      assert.deepEqual(error.providerDiagnostic, { status, ...(status === 409 ? { title: "Conflict" } : {}), field: "amount" });
      assert.doesNotMatch(JSON.stringify(error), /Authorization|test_example_key|customer@example|unverified-code|metadata|raw-body|private|_links/);
      return true;
    });
  }
});

test("Mollie error diagnostics discard untrusted text even in recognised fields", async () => {
  const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"],
    fetch: async () => response({ status: 409, title: "Authorization: Bearer test_example_key", field: "customer@example.test", detail: "sensitive" }, 409) });
  await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) => {
    assert.ok(error instanceof PaymentProviderError); assert.deepEqual(error.providerDiagnostic, { status: 409 }); return true;
  });
});

test("Mollie malformed, missing, oversized and failed error bodies preserve generic conflict handling", async () => {
  const bodies = ["{", "not JSON", "null", "[]", "{}", '{"status":422,"title":"Conflict"}', '{"status":409,"title":{}}', JSON.stringify({ status: 409, title: "Conflict", detail: "x".repeat(4096) })];
  const responses = bodies.map((body) => new Response(body, { status: 409, headers: { "content-type": "application/json" } }));
  responses.push(new Response("<html>private</html>", { status: 409, headers: { "content-type": "text/html" } }));
  responses.push(new Response(new ReadableStream({ start(controller) { controller.error(new Error("secret stream failure")); } }), { status: 409, headers: { "content-type": "application/hal+json" } }));
  responses.push(new Response(new ReadableStream({ start() { /* Never finishes: diagnostics must time out. */ } }), { status: 409, headers: { "content-type": "application/json" } }));
  for (const result of responses) {
    const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], fetch: async () => result });
    await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) => {
      assert.ok(error instanceof PaymentProviderError); assert.equal(error.category, "conflict"); assert.equal(error.retryable, true);
      assert.equal(error.message, "Mollie reported a conflicting request."); assert.equal(error.providerDiagnostic, undefined); return true;
    });
  }
});

test("Mollie requests time out and surface an ambiguous retryable network error", async () => {
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], requestTimeoutMs: 5,
    fetch: async (_url, init) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });
  await assert.rejects(() => provider.getPayment({ providerPaymentId: "tr_1", correlationId: "corr-1" }), (error: unknown) =>
    error instanceof PaymentProviderError && error.category === "network_error" && error.retryable);
});

test("Mollie adapter cannot be configured with a live key", () => {
  assert.throws(() => new MollieTestPaymentProvider({ apiKey: "live_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"] }), /test API key/);
});

test("classic Mollie webhook authenticates by retrieving the referenced payment", async () => {
  const requestedUrls: string[] = [];
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://api.cyph1.co.uk"],
    fetch: async (url) => {
      requestedUrls.push(String(url));
      if (String(url).endsWith("/refunds")) return response({ _embedded: { refunds: [] } });
      return response({ id: "tr_webhook1", status: "paid", createdAt: "2026-08-29T12:00:00Z", paidAt: "2026-08-29T12:01:00Z", amount: { currency: "GBP", value: "120.00" }, metadata: { orderId: "order_1" } });
    },
  });
  const verified = await provider.verifyWebhook({
    rawBody: new TextEncoder().encode("id=tr_webhook1"),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    endpointUrl: "https://api.cyph1.co.uk/webhooks/mollie",
  });
  assert.deepEqual(requestedUrls, ["https://api.mollie.com/v2/payments/tr_webhook1", "https://api.mollie.com/v2/payments/tr_webhook1/refunds"]);
  assert.equal(verified.outcome, "actionable");
  const events = await provider.normaliseWebhook(verified);
  assert.deepEqual(events.map((event) => ({ id: event.eventId, type: event.type, amount: event.amount?.value })), [
    { id: "payment:tr_webhook1:paid", type: "payment.paid", amount: 12_000 },
  ]);
});


test("classic Mollie webhook emits authoritative refund events", async () => {
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://api.cyph1.co.uk"],
    fetch: async (url) => String(url).endsWith("/refunds")
      ? response({ _embedded: { refunds: [{ id: "re_partial1", status: "refunded", amount: { currency: "GBP", value: "20.00" }, createdAt: "2026-08-29T12:05:00Z" }] } })
      : response({ id: "tr_webhook1", status: "paid", createdAt: "2026-08-29T12:00:00Z", paidAt: "2026-08-29T12:01:00Z", amount: { currency: "GBP", value: "120.00" }, amountRefunded: { currency: "GBP", value: "20.00" } }),
  });
  const verified = await provider.verifyWebhook({
    rawBody: new TextEncoder().encode("id=tr_webhook1"),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    endpointUrl: "https://api.cyph1.co.uk/webhooks/mollie",
  });
  const events = await provider.normaliseWebhook(verified);
  assert.deepEqual(events.map((event) => ({ id: event.eventId, type: event.type, amount: event.amount?.value })), [
    { id: "payment:tr_webhook1:paid", type: "payment.paid", amount: 12_000 },
    { id: "refund:re_partial1:refunded", type: "refund.completed", amount: 2_000 },
  ]);
});
test("classic Mollie webhook rejects malformed bodies and unapproved endpoints before API access", async () => {
  let calls = 0;
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://api.cyph1.co.uk"],
    fetch: async () => { calls += 1; return response({}); },
  });
  const malformed = await provider.verifyWebhook({ rawBody: new TextEncoder().encode("id=tr_1&extra=true"), headers: { "Content-Type": "application/x-www-form-urlencoded" }, endpointUrl: "https://api.cyph1.co.uk/webhooks/mollie" });
  const invalid = await provider.verifyWebhook({ rawBody: new TextEncoder().encode("id=tr_1"), headers: { "Content-Type": "application/x-www-form-urlencoded" }, endpointUrl: "https://attacker.example/webhook" });
  assert.equal(malformed.outcome, "malformed");
  assert.equal(invalid.outcome, "invalid");
  assert.equal(calls, 0);
});

test("server-side factory remains disabled by default and fails closed on incomplete Mollie configuration", () => {
  const disabled = createPaymentProviderRegistry({});
  assert.throws(() => disabled.getConfiguredProvider(), /not configured/);
  assert.throws(() => createPaymentProviderRegistry({ PAYMENT_PROVIDER: "mollie-test" }), /requires an API key/);
  assert.throws(() => createPaymentProviderRegistry({
    PAYMENT_PROVIDER: "mollie-test", MOLLIE_API_KEY: "live_example_key", PAYMENT_CALLBACK_ORIGINS: "https://checkout.cyph1.co.uk",
  }), /test API key/);
});

test("commerce configuration rejects secret-like public variables", () => {
  assert.throws(() => loadCommerceConfig({ ["PUBLIC_" + "MOLLIE_API_KEY"]: "test_secret" }), /must not use the PUBLIC_ prefix/);
  assert.throws(() => loadCommerceConfig({ ["PUBLIC_" + "DATABASE_URL"]: "postgresql:\/\/example" }), /must not use the PUBLIC_ prefix/);
  assert.doesNotThrow(() => loadCommerceConfig({ PUBLIC_COMMERCE_UI_ENABLED: "false" }));
});
