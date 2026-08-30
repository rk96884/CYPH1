import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutError, type InitiateCheckoutInput } from "./service.js";
import { handleCheckoutRequest } from "./handler.js";

const body = {
  productSlug: "integration-test-fixture", quantity: 1, shippingRateId: "rate_test",
  email: "test@example.invalid", correlationId: "correlation-test",
  deliveryAddress: { recipientName: "Test Customer", line1: "1 Test Street", locality: "London", postalCode: "SW1A 1AA", countryCode: "GB" },
};

test("checkout handler requires JSON POST and an idempotency key", async () => {
  const checkout = { async initiate() { throw new Error("must not run"); } };
  assert.equal((await handleCheckoutRequest(new Request("https://api.example/checkout"), checkout)).status, 405);
  assert.equal((await handleCheckoutRequest(new Request("https://api.example/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), checkout)).status, 400);
});

test("checkout handler returns only the safe hosted checkout result", async () => {
  let input: InitiateCheckoutInput | undefined;
  const response = await handleCheckoutRequest(new Request("https://api.example/checkout", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-1" }, body: JSON.stringify(body),
  }), { async initiate(value) {
    input = value;
    return { orderId: "order-1", orderNumber: "CYPH-T-1", status: "pending_payment", checkoutUrl: "https://www.mollie.com/checkout/test", replayed: false };
  } });
  assert.equal(response.status, 201);
  assert.equal(input?.idempotencyKey, "idem-1");
  assert.deepEqual(await response.json(), { orderId: "order-1", orderNumber: "CYPH-T-1", status: "pending_payment", checkoutUrl: "https://www.mollie.com/checkout/test", replayed: false });
});

test("checkout handler maps disabled commerce to an undiscoverable response", async () => {
  const response = await handleCheckoutRequest(new Request("https://api.example/checkout", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-1" }, body: JSON.stringify(body),
  }), { async initiate() { throw new CheckoutError("disabled", "Commerce is not enabled."); } });
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
