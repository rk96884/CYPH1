import { money, importChargesNotice } from "../../../../packages/commerce-core/src/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutError, type CheckoutService, type InitiateCheckoutInput } from "./service.js";
import { handleCheckoutRequest } from "./handler.js";

const body = {
  productSlug: "integration-test-fixture", quantity: 1, shippingRateId: "rate_test",
  email: "test@example.invalid", correlationId: "correlation-test",
  deliveryAddress: { givenName: "Test", familyName: "Customer", line1: "1 Test Street", locality: "London", postalCode: "SW1A 1AA", countryCode: "GB" },
};

const post = (value: unknown, key = "idem-1") => new Request("https://api.example/checkout", {
  method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(value),
});

test("checkout handler requires JSON POST and an idempotency key", async () => {
  const checkout = { async initiate() { throw new Error("must not run"); } };
  assert.equal((await handleCheckoutRequest(new Request("https://api.example/checkout"), checkout)).status, 405);
  assert.equal((await handleCheckoutRequest(new Request("https://api.example/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), checkout)).status, 400);
});

test("checkout handler rejects malformed structured input and unknown payment methods before the service", async () => {
  let calls = 0;
  const checkout = { async initiate() { calls += 1; throw new Error("must not run"); } };
  const malformed = [
    {},
    { ...body, email: 123 },
    { ...body, quantity: "1" },
    { ...body, paymentMethod: "not-klarna" },
    { ...body, deliveryAddress: null },
    { ...body, deliveryAddress: { ...body.deliveryAddress, givenName: 123 } },
    { ...body, deliveryAddress: { ...body.deliveryAddress, familyName: undefined } },
    { ...body, deliveryAddress: { ...body.deliveryAddress, postalCode: 123 } },
  ];
  for (const value of malformed) {
    const response = await handleCheckoutRequest(post(value, "malformed-test"), checkout);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: "Invalid request." });
  }
  assert.equal(calls, 0);
});

test("checkout handler forwards Klarna selection and returns only the safe hosted checkout result", async () => {
  let input: InitiateCheckoutInput | undefined;
  const response = await handleCheckoutRequest(post({ ...body, paymentMethod: "klarna" }), { async initiate(value) {
    input = value;
    return { orderId: "order-1", orderNumber: "CYPH-T-1", status: "pending_payment", checkoutUrl: "https://www.mollie.com/checkout/test", replayed: false };
  } });
  assert.equal(response.status, 201);
  assert.equal(input?.idempotencyKey, "idem-1");
  assert.equal(input?.paymentMethod, "klarna");
  assert.equal(input?.deliveryAddress.givenName, "Test");
  assert.equal(input?.deliveryAddress.familyName, "Customer");
  assert.deepEqual(await response.json(), { orderId: "order-1", orderNumber: "CYPH-T-1", status: "pending_payment", checkoutUrl: "https://www.mollie.com/checkout/test", replayed: false });
});

test("checkout handler maps disabled commerce to an undiscoverable response", async () => {
  const response = await handleCheckoutRequest(post(body), { async initiate() { throw new CheckoutError("disabled", "Commerce is not enabled."); } });
  assert.equal(response.status, 404);
});

test("checkout handler allows only the configured private storefront origin", async () => {
  const checkout = { async initiate() { throw new Error("must not run"); } };
  const allowed = "https://preview.example";
  const preflight = await handleCheckoutRequest(new Request("https://api.example/checkout", {
    method: "OPTIONS", headers: { Origin: allowed },
  }), checkout, { allowedOrigin: allowed });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), allowed);
  const denied = await handleCheckoutRequest(new Request("https://api.example/checkout", {
    method: "OPTIONS", headers: { Origin: "https://untrusted.example" },
  }), checkout, { allowedOrigin: allowed });
  assert.equal(denied.status, 403);
});

import { handleCheckoutQuoteRequest } from "./handler.js";
test("shipping quote endpoint applies origin/method/schema checks and contains no payment creation", async () => {
  const requests: unknown[] = [];
  const quote: Pick<CheckoutService, "quote"> = { quote: async (input: { productSlug: string; quantity: number; countryCode: string }) => { requests.push(input); return { shippingRateId: "r", countryCode: "TR", zoneKey: "europe", methodName: "Tracked postage and packing", subtotalMinor: 7499, taxMinor: 0, deliveryMinor: 1499, totalMinor: 8998, currency: money(0, "GBP").currency, importChargesNotice }; } };
  const options = { allowedOrigin: "https://store.example" };
  const request = (body: unknown, origin = options.allowedOrigin) => new Request("https://api.example/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await handleCheckoutQuoteRequest(request({}), quote, options)).status, 400);
  assert.equal((await handleCheckoutQuoteRequest(request({}, "https://evil.example"), quote, options)).status, 403);
  const response = await handleCheckoutQuoteRequest(request({ productSlug: "fixture", quantity: 1, countryCode: "TR", deliveryMinor: 1 }), quote, options);
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(requests, [{ productSlug: "fixture", quantity: 1, countryCode: "TR" }]);
  assert.equal((await response.json() as { deliveryMinor: number }).deliveryMinor, 1499);
  assert.equal((await handleCheckoutQuoteRequest(new Request("https://api.example/checkout/quote"), quote, options)).status, 405);
  assert.equal((await handleCheckoutQuoteRequest(request({ productSlug: "fixture", quantity: 1, countryCode: "DE" }), { quote: async () => { throw new CheckoutError("unavailable", "Not approved."); } }, options)).status, 409);
});
