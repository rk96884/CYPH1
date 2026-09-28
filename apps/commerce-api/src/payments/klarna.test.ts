import assert from "node:assert/strict";
import test from "node:test";
import { money, PaymentProviderError, type CreateCheckoutInput } from "../../../../packages/commerce-core/src/index.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const address = { email: "buyer@example.com", givenName: "Test", familyName: "Buyer", streetAndNumber: "1 Test Street", postalCode: "TW1 1AA", city: "London", country: "GB" } as const;
const input = (overrides: Partial<CreateCheckoutInput> = {}): CreateCheckoutInput => ({
  orderId: "order_klarna_1", orderNumber: "CYPH-KLARNA-1", amount: money(12_000, "GBP"),
  lines: [{ description: "Approved product", quantity: 1, unitPrice: money(12_000, "GBP"), totalAmount: money(12_000, "GBP") }],
  method: "klarna", captureMode: "manual", customer: address, shippingAddress: address,
  successUrl: "https://checkout.cyph1.co.uk/orders/order_klarna_1", cancellationUrl: "https://checkout.cyph1.co.uk/orders/order_klarna_1/cancelled",
  webhookUrl: "https://api.cyph1.co.uk/webhooks/mollie", idempotencyKey: "idem-klarna-1", correlationId: "corr-klarna-1", ...overrides,
});
test("Klarna capture rejects an amount above the authorised amount before contacting Mollie", async () => {
  let fetchCalls = 0;

  const provider = new MollieTestPaymentProvider({
    apiKey: "test_klarna_key",
    allowedCallbackOrigins: ["https://preview.example"],
    fetch: async () => {
      fetchCalls += 1;
      throw new Error("Mollie must not be contacted");
    },
  });

  await assert.rejects(
    () =>
      provider.capture!({
        paymentId: "payment_klarna_1",
        orderId: "order_klarna_1",
        providerPaymentId: "tr_klarna1",
        amount: money(12_001, "GBP"),
        authorisedAmount: money(12_000, "GBP"),
        operatorId: "fulfilment-worker",
        idempotencyKey: "capture-over-limit",
        correlationId: "corr-klarna-over-limit",
      }),
    (error: unknown) =>
      error instanceof PaymentProviderError &&
      error.category === "validation_error",
  );

  assert.equal(fetchCalls, 0);
});

test("Klarna capture rejects a currency mismatch before contacting Mollie", async () => {
  let fetchCalls = 0;

  const provider = new MollieTestPaymentProvider({
    apiKey: "test_klarna_key",
    allowedCallbackOrigins: ["https://preview.example"],
    fetch: async () => {
      fetchCalls += 1;
      throw new Error("Mollie must not be contacted");
    },
  });

  await assert.rejects(
    () =>
      provider.capture!({
        paymentId: "payment_klarna_1",
        orderId: "order_klarna_1",
        providerPaymentId: "tr_klarna1",
        amount: money(12_000, "EUR"),
        authorisedAmount: money(12_000, "GBP"),
        operatorId: "fulfilment-worker",
        idempotencyKey: "capture-currency-mismatch",
        correlationId: "corr-klarna-currency",
      }),
    (error: unknown) =>
      error instanceof PaymentProviderError &&
      error.category === "validation_error",
  );

  assert.equal(fetchCalls, 0);
});

test("Klarna checkout sends method, manual capture and customer addresses", async () => {
  let body: Record<string, unknown> | undefined;
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"], fetch: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return response({ id: "tr_klarna1", status: "open", createdAt: "2026-09-28T12:00:00Z", amount: { currency: "GBP", value: "120.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/select-method/tr_klarna1" } } }, 201);
    }
  });
  await provider.createCheckout(input());
  assert.equal(body?.method, "klarna");
  assert.equal(body?.captureMode, "manual");
  assert.deepEqual(body?.billingAddress, address);
  assert.deepEqual(body?.shippingAddress, address);
});

test("Klarna checkout fails closed without complete billing details or manual capture", async () => {
  const provider = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"], fetch: async () => { throw new Error("must not call"); } });
  await assert.rejects(() => provider.createCheckout(input({ customer: { email: "buyer@example.com" } })), /complete billing details/);
  await assert.rejects(() => provider.createCheckout(input({ captureMode: "automatic" })), /manual capture/);
});

test("Mollie exposes Klarna capture deadline and creates an idempotent capture", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const provider = new MollieTestPaymentProvider({
    apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], fetch: async (url, init) => {
      requests.push({
        url: String(url),
        ...(init ? { init } : {}),
      });
      if (String(url).endsWith("/captures")) return response({ id: "cpt_1", status: "pending", amount: { currency: "GBP", value: "120.00" }, createdAt: "2026-09-28T12:05:00Z" }, 201);
      return response({ id: "tr_klarna1", status: "authorized", createdAt: "2026-09-28T12:00:00Z", authorizedAt: "2026-09-28T12:01:00Z", captureBefore: "2026-10-26T12:01:00Z", amount: { currency: "GBP", value: "120.00" }, metadata: { orderId: "order_klarna_1" } });
    }
  });
  const payment = await provider.getPayment({ providerPaymentId: "tr_klarna1", correlationId: "corr-klarna-1" });
  assert.equal(payment.status, "authorised");
  assert.equal(payment.captureBefore, "2026-10-26T12:01:00.000Z");
  assert.equal(payment.authorisedAt, "2026-09-28T12:01:00.000Z");
  const capture = await provider.capture({ paymentId: "payment_klarna_1", orderId: "order_klarna_1", providerPaymentId: "tr_klarna1", amount: money(12_000, "GBP"), authorisedAmount: money(12_000, "GBP"), operatorId: "fulfilment-worker", idempotencyKey: "capture-order-klarna-1", correlationId: "corr-klarna-1" });
  assert.equal(capture.providerCaptureId, "cpt_1");
  assert.equal(capture.status, "pending");
  assert.equal(requests[1]?.url, "https://api.mollie.com/v2/payments/tr_klarna1/captures");
  assert.equal(new Headers(requests[1]?.init?.headers).get("Idempotency-Key"), "capture-order-klarna-1");
});
