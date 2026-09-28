import assert from "node:assert/strict";
import test from "node:test";
import { money, PaymentProviderError, type CreateCheckoutInput, type PaymentProvider, type ShippingRate } from "../../../../packages/commerce-core/src/index.js";
import { CheckoutError, CheckoutService, type CheckoutOrder, type CheckoutRepository, type CheckoutResult } from "./service.js";

class MemoryCheckoutRepository implements CheckoutRepository {
  readonly orders: CheckoutOrder[] = [];
  readonly completed = new Map<string, CheckoutResult>();
  readonly abandoned: string[] = [];
  readonly resolutionRequired: string[] = [];

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
  async abandonOrder(orderId: string) { this.abandoned.push(orderId); }
  async markResolutionRequired(orderId: string) { this.resolutionRequired.push(orderId); }
}

const provider = (capture: CreateCheckoutInput[]): PaymentProvider => ({
  key: "mollie-test",
  async createCheckout(input) {
    capture.push(input);
    return {
      provider: "mollie-test", providerPaymentId: "tr_test", checkoutUrl: "https://www.mollie.com/checkout/test",
      status: input.method === "klarna" ? "authorised" : "pending", metadata: {},
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
    givenName: "Test", familyName: "Customer", line1: "1 Test Street", locality: "London",
    postalCode: "SW1A 1AA", countryCode: "GB",
  },
  ...overrides,
});

const urls = {
  orderStatusBaseUrl: "https://preview.example/orders",
  cancellationBaseUrl: "https://preview.example/orders",
  webhookUrl: "https://api.example/webhooks/mollie",
};

const serviceFor = (repository: MemoryCheckoutRepository, captured: CreateCheckoutInput[]) => new CheckoutService(
  { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
  repository, provider(captured), urls, true,
);

test("private checkout recalculates authoritative totals and creates a pending hosted checkout", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  const result = await serviceFor(repository, captured).initiate(request());
  assert.equal(result.status, "pending_payment");
  assert.equal(result.replayed, false);
  assert.equal(captured[0]?.amount.value, 12_500);
  assert.equal(captured[0]?.lines.reduce((sum, line) => sum + line.totalAmount.value, 0), 12_500);
  assert.deepEqual(captured[0]?.customer, { email: "test@example.com" });
  assert.equal(captured[0]?.method, undefined);
  assert.equal(captured[0]?.shippingAddress, undefined);
  assert.equal(repository.orders[0]?.subtotalMinor, 10_000);
  assert.equal(repository.orders[0]?.taxMinor, 2_000);
  assert.equal(repository.orders[0]?.deliveryMinor, 500);
  assert.equal(repository.orders[0]?.email, "test@example.com");
  assert.equal(repository.orders[0]?.deliveryAddress.givenName, "Test");
  assert.equal(repository.orders[0]?.deliveryAddress.familyName, "Customer");
});

test("Klarna checkout sends structured billing and shipping data with manual capture", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  await serviceFor(repository, captured).initiate(request({ paymentMethod: "klarna" }));
  const input = captured[0];
  assert.ok(input);
  assert.equal(input.method, "klarna");
  assert.equal(input.captureMode, "manual");
  assert.deepEqual(input.customer, {
    email: "test@example.com", givenName: "Test", familyName: "Customer",
    streetAndNumber: "1 Test Street", postalCode: "SW1A 1AA", city: "London", country: "GB",
  });
  assert.deepEqual(input.shippingAddress, input.customer);
});

test("checkout retries replay the stored hosted session without another provider call", async () => {
  const repository = new MemoryCheckoutRepository();
  const captured: CreateCheckoutInput[] = [];
  const service = serviceFor(repository, captured);
  await service.initiate(request());
  const replay = await service.initiate(request());
  assert.equal(replay.replayed, true);
  assert.equal(captured.length, 1);
});

test("checkout fails closed when commerce is disabled", async () => {
  const service = new CheckoutService(
    { commerceEnabled: false, paymentProvider: "disabled", fulfilmentMode: "disabled", fulfilmentProvider: "disabled" },
    new MemoryCheckoutRepository(), provider([]), urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "disabled");
});

test("private products require the explicit private-test boundary", async () => {
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    new MemoryCheckoutRepository(), provider([]), urls, false,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "unavailable");
});

test("ambiguous retryable provider failures are held for resolution without cancelling the order", async () => {
  const repository = new MemoryCheckoutRepository();
  const failing = provider([]);
  failing.createCheckout = async () => { throw new PaymentProviderError("network_error", "timed out", true); };
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    repository, failing, urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "provider_error");
  assert.equal(repository.orders.length, 1);
  assert.deepEqual(repository.resolutionRequired, [repository.orders[0]?.id]);
  assert.deepEqual(repository.abandoned, []);
});

test("definitive non-retryable provider failures abandon the draft order", async () => {
  const repository = new MemoryCheckoutRepository();
  const failing = provider([]);
  failing.createCheckout = async () => { throw new PaymentProviderError("validation_error", "rejected"); };
  const service = new CheckoutService(
    { commerceEnabled: true, paymentProvider: "mollie-test", fulfilmentMode: "test", fulfilmentProvider: "manual-test" },
    repository, failing, urls, true,
  );
  await assert.rejects(() => service.initiate(request()), (error: unknown) => error instanceof CheckoutError && error.code === "provider_error");
  assert.deepEqual(repository.abandoned, [repository.orders[0]?.id]);
  assert.deepEqual(repository.resolutionRequired, []);
});
