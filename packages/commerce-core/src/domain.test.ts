import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent } from "./audit.js";
import { calculateBasket } from "./basket.js";
import { CommerceDomainError } from "./errors.js";
import { assertFulfilmentRequest, orderFulfilmentStatusFor, transitionFulfilment } from "./fulfilment.js";
import { executeIdempotent, InMemoryIdempotencyStore } from "./idempotency.js";
import { money } from "./money.js";
import { quoteShipping, type ShippingRate } from "./shipping.js";
import { transitionOrder, transitionPayment } from "./state-machine.js";

test("basket totals integer minor units and preserves quantity", () => {
  const basket = calculateBasket([
    { productId: "p1", sku: "CYPH1", quantity: 2, unitPrice: money(10_000, "GBP"), unitTax: money(2_000, "GBP"), unitWeightGrams: 400 },
  ], money(1_000, "GBP"), money(500, "GBP"));
  assert.equal(basket.subtotal.value, 20_000);
  assert.equal(basket.tax.value, 4_000);
  assert.equal(basket.total.value, 23_500);
  assert.equal(basket.totalWeightGrams, 800);
});

test("basket rejects mixed currencies and invalid quantities", () => {
  assert.throws(() => calculateBasket([
    { productId: "p1", sku: "A", quantity: 1, unitPrice: money(100, "GBP"), unitTax: money(20, "EUR"), unitWeightGrams: 100 },
  ], money(0, "GBP"), money(0, "GBP")), CommerceDomainError);
  assert.throws(() => calculateBasket([
    { productId: "p1", sku: "A", quantity: 0, unitPrice: money(100, "GBP"), unitTax: money(20, "GBP"), unitWeightGrams: 100 },
  ], money(0, "GBP"), money(0, "GBP")), CommerceDomainError);
});

const rate = (overrides: Partial<ShippingRate> = {}): ShippingRate => ({
  id: "uk-standard", zoneKey: "uk", methodKey: "standard", methodName: "Standard delivery",
  price: money(499, "GBP"), status: "active", effectiveFrom: new Date("2026-01-01T00:00:00Z"), ...overrides,
});

test("country shipping override replaces its zone rate and can become free", () => {
  const quotes = quoteShipping({
    destination: { countryCode: "GB", zoneKey: "uk", status: "active" },
    rates: [rate(), rate({ id: "gb-standard", countryCode: "GB", price: money(399, "GBP"), freeShippingThreshold: 5_000 })],
    basketSubtotal: money(10_000, "GBP"), totalWeightGrams: 500, at: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0]?.rateId, "gb-standard");
  assert.equal(quotes[0]?.price.value, 0);
});

test("disabled destination cannot be quoted", () => {
  assert.throws(() => quoteShipping({
    destination: { countryCode: "US", zoneKey: "global", status: "disabled" }, rates: [rate({ zoneKey: "global" })],
    basketSubtotal: money(10_000, "GBP"), totalWeightGrams: 500,
  }), (error: unknown) => error instanceof CommerceDomainError && error.code === "unsupported_shipping_destination");
});

test("order and payment lifecycle rules handle repeats and stale events", () => {
  assert.equal(transitionOrder("draft", "pending_payment"), "pending_payment");
  assert.throws(() => transitionOrder("paid", "draft"), CommerceDomainError);
  assert.deepEqual(transitionPayment("pending", "captured"), { status: "captured", outcome: "applied" });
  assert.deepEqual(transitionPayment("captured", "pending"), { status: "captured", outcome: "ignored" });
  assert.deepEqual(transitionPayment("captured", "failed"), { status: "captured", outcome: "requires_review" });
});

test("disputes apply in order and unsafe out-of-order resolution requires review", () => {
  assert.deepEqual(transitionPayment("captured", "dispute_opened"), { status: "dispute_opened", outcome: "applied" });
  assert.deepEqual(transitionPayment("dispute_opened", "dispute_opened"), { status: "dispute_opened", outcome: "ignored" });
  assert.deepEqual(transitionPayment("dispute_opened", "dispute_resolved"), { status: "dispute_resolved", outcome: "applied" });
  assert.deepEqual(transitionPayment("captured", "dispute_resolved"), { status: "captured", outcome: "requires_review" });
});

test("fulfilment lifecycle applies forward events and safely ignores repeats", () => {
  assert.deepEqual(transitionFulfilment("accepted", "dispatched"), { status: "dispatched", outcome: "applied" });
  assert.deepEqual(transitionFulfilment("dispatched", "accepted"), { status: "dispatched", outcome: "ignored" });
  assert.deepEqual(transitionFulfilment("delivered", "cancelled"), { status: "delivered", outcome: "requires_review" });
  assert.equal(orderFulfilmentStatusFor("accepted"), "processing");
  assert.equal(orderFulfilmentStatusFor("failed"), "unfulfilled");
});

test("fulfilment requests require positive quantities and ISO country codes", () => {
  const valid = {
    idempotencyKey: "fulfilment:event-1", orderId: "order-1", orderNumber: "CYPH1-1",
    deliveryAddress: { recipientName: "Test", line1: "1 Test Street", locality: "London", postalCode: "SW1A 1AA", countryCode: "GB" },
    lines: [{ sku: "TEST-SKU", quantity: 1 }],
  };
  assert.doesNotThrow(() => assertFulfilmentRequest(valid));
  assert.throws(() => assertFulfilmentRequest({ ...valid, lines: [{ sku: "TEST-SKU", quantity: 0 }] }), CommerceDomainError);
  assert.throws(() => assertFulfilmentRequest({ ...valid, deliveryAddress: { ...valid.deliveryAddress, countryCode: "gb" } }), CommerceDomainError);
});

test("idempotent execution replays a completed result and rejects key reuse", async () => {
  const store = new InMemoryIdempotencyStore<{ orderId: string }>();
  let calls = 0;
  const first = await executeIdempotent({ key: "checkout-1", fingerprint: "basket-a", store, execute: async () => { calls += 1; return { orderId: "o1" }; } });
  const replay = await executeIdempotent({ key: "checkout-1", fingerprint: "basket-a", store, execute: async () => { calls += 1; return { orderId: "o2" }; } });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.result.orderId, "o1");
  assert.equal(calls, 1);
  await assert.rejects(() => executeIdempotent({ key: "checkout-1", fingerprint: "basket-b", store, execute: async () => ({ orderId: "o3" }) }), /different request/);
});

test("failed idempotent commands release their reservation for retry", async () => {
  const store = new InMemoryIdempotencyStore<string>();
  await assert.rejects(() => executeIdempotent({ key: "k", fingerprint: "f", store, execute: async () => { throw new Error("temporary"); } }));
  const retry = await executeIdempotent({ key: "k", fingerprint: "f", store, execute: async () => "ok" });
  assert.deepEqual(retry, { result: "ok", replayed: false });
});

test("audit events are immutable and carry explicit aggregate identity", () => {
  const event = createAuditEvent({
    eventType: "payment.transition_ignored", aggregateType: "payment", aggregateId: "pay_1",
    actorType: "provider", occurredAt: new Date("2026-08-29T12:00:00Z"), metadata: { from: "captured", to: "pending" },
  });
  assert.equal(event.occurredAt, "2026-08-29T12:00:00.000Z");
  assert.equal(event.metadata.from, "captured");
  assert.throws(() => createAuditEvent({ eventType: "", aggregateType: "payment", aggregateId: "pay_1", actorType: "system" }), CommerceDomainError);
});
