import assert from "node:assert/strict";
import test from "node:test";
import { PaymentProviderError, money, type CreateCheckoutInput } from "../../../../packages/commerce-core/src/index.js";
import { MollieLivePaymentProvider } from "./mollie-live.js";
import { createPaymentProviderRegistry } from "./factory.js";

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const checkoutInput = (): CreateCheckoutInput => ({
  orderId: "order_live_1", orderNumber: "CYPH-LIVE-0001", amount: money(100, "GBP"),
  lines: [{ description: "CYPH/1 live readiness", quantity: 1, unitPrice: money(100, "GBP"), totalAmount: money(100, "GBP") }],
  successUrl: "https://checkout.cyph1.co.uk/orders/order_live_1",
  cancellationUrl: "https://checkout.cyph1.co.uk/orders/order_live_1/cancelled",
  webhookUrl: "https://api.cyph1.co.uk/webhooks/mollie",
  idempotencyKey: "live-readiness-1", correlationId: "live-readiness-1",
});

test("Mollie live adapter fails closed on non-live credentials", () => {
  assert.throws(() => new MollieLivePaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"] }), /live API key/);
});

test("Mollie live adapter sends the live credential and reports live provider identity", async () => {
  let authorization: string | null = null;
  const provider = new MollieLivePaymentProvider({
    apiKey: "live_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk", "https://api.cyph1.co.uk"],
    fetch: async (_url, init) => {
      authorization = new Headers(init?.headers).get("Authorization");
      return response({ id: "tr_live1", status: "open", createdAt: "2026-09-25T12:00:00Z", amount: { currency: "GBP", value: "1.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/select-method/tr_live1" } } }, 201);
    },
  });
  const result = await provider.createCheckout(checkoutInput());
  assert.equal(authorization, "Bearer live_example_key");
  assert.equal(result.provider, "mollie-live");
});

test("factory keeps test and live credentials isolated", () => {
  assert.throws(() => createPaymentProviderRegistry({ PAYMENT_PROVIDER: "mollie-live", MOLLIE_API_KEY: "test_example_key", PAYMENT_CALLBACK_ORIGINS: "https://checkout.cyph1.co.uk" }), PaymentProviderError);
  assert.throws(() => createPaymentProviderRegistry({ PAYMENT_PROVIDER: "mollie-test", MOLLIE_API_KEY: "live_example_key", PAYMENT_CALLBACK_ORIGINS: "https://checkout.cyph1.co.uk" }), PaymentProviderError);
  assert.doesNotThrow(() => createPaymentProviderRegistry({ PAYMENT_PROVIDER: "mollie-live", MOLLIE_API_KEY: "live_example_key", PAYMENT_CALLBACK_ORIGINS: "https://checkout.cyph1.co.uk" }));
});
