import assert from "node:assert/strict";
import test from "node:test";
import { money, type PaymentProvider, type ShippingRate } from "../../../../packages/commerce-core/src/index.js";
import { CheckoutError, CheckoutService, type CheckoutOrder, type CheckoutRepository, type CheckoutResult } from "./service.js";

class MemoryCheckoutRepository implements CheckoutRepository {
  readonly orders: CheckoutOrder[] = [];
  readonly completed = new Map<string, CheckoutResult>();

  async getProduct() {
    return {
      id: "product_test", sku: "INTEGRATION-TEST", slug: "integration-test-fixture",
      name: "Integration test fixture", status: "private" as const,
      priceMinor: 10_000, unitTaxMinor: 2_000, currency: "GBP",
      shippingWeightGrams: 500, availableQuantity: 3,
    };
  }

  async getShipping() {
    const rate: ShippingRate = {
      id: "rate_test", zoneKey: "uk-test", countryCode: "GB", methodKey: "test-delivery",
      methodName: "Test delivery", price: money(500, "GBP"), status: "test",
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    };
    return { destination: { countryCode: "GB", zoneKey: "uk-test", status: "test" as const }, rates: [rate] };
  }

  async findCheckout(idempotencyKey: string) { return this.completed.get(idempotencyKey); }
  async createOrder(order: CheckoutOrder) { this.orders.push(order); }
  async attachPayment(input: Readonly<{ orderId: string; checkoutUrl: string; idempotencyKey: string }>) {
    const order = this.orders.find((candidate) => candidate.id === input.orderId);
    assert.ok(order);
    this.completed.set(input.idempotencyKey, {
      orderId: order.id, orderNumber: order.orderNumber, status: "pending_payment",
      checkoutUrl: input.checkoutUrl, replayed: false,
    });
  }
  async abandonOrder() {}
}

const provider = (capture: Array<Readonly<{ amount: number; lines: number }>>): PaymentProvider => ({
  key: "mollie-test",
  async createCheckout(input) {
    capture.push({ amount: input.amount.value, lines: input.lines.reduce((sum, line) => sum + line.totalAmount.value, 0) });
    return {
      provider: "mollie-test", providerPaymentId: "tr_test", checkoutUrl: "https://www.mollie.com/checkout/test",
      status: "pending", metadata: {},
    };
  },
  async getPayment() { throw new Error("not used"); },
  async refund() { throw new Error("not used"); },
  async verifyWebhook() { throw new Error("not used"); },
  async normaliseWebhook() { throw new Error("not used"); },
});

const request = (overrides = {}) => ({
  productSlug: "integration-test-fixture", quantity: 1, shippingRateId: "rate_test",
  email: "Test@Example.com", idempotencyKey: "checkout-test-1", correlationId: "correlation-test-1",
  deliveryAddress: {
    recipientName: "Test Customer", line1: "1 Test Street", locality: "London",
    postalCode: "SW1A 1AA", countryCode: "GB",
  },
  ...overrides,
});

const urls = {
  orderStatusBaseUrl: "https://preview.example/orders",
  cancellationBaseUrl: "https://preview.example/orders",
  webhookUrl: "https://api.example/webhooks/mollie",
};

test("private checkout recalculates authoritative totals and creates a pending hosted checkout", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: Array<Readonly<{ amount: number; lines: number }>> = [];
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test" },
    repository, provider(captured), urls, true,
  );
  const result = await service.initiate(request());
  assert.equal(result.status, "pending_payment");
  assert.equal(result.replayed, false);
  assert.deepEqual(captured, [{ amount: 12_500, lines: 12_500 }]);
  assert.equal(repository.orders[0]?.subtotalMinor, 10_000);
  assert.equal(repository.orders[0]?.taxMinor, 2_000);
  assert.equal(repository.orders[0]?.deliveryMinor, 500);
  assert.equal(repository.orders[0]?.email, "test@example.com");
});

test("checkout retries replay the stored hosted session without another provider call", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: Array<Readonly<{ amount: number; lines: number }>> = [];
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test" },
    repository, provider(captured), urls, true,
  );
  await service.initiate(request());
  const replay = await service.initiate(request());
  assert.equal(replay.replayed, true);
  assert.equal(captured.length, 1);
});

test("checkout fails closed when commerce is disabled", async () => {
  const service = new CheckoutService(
    { commerceEnabled: false, paymentProvider: "disabled", fulfilmentMode: "disabled" },
    new MemoryCheckoutRepository(), provider([]), urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "disabled");
});

test("private products require the explicit private-test boundary", async () => {
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test" },
    new MemoryCheckoutRepository(), provider([]), urls, false,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "unavailable");
});
