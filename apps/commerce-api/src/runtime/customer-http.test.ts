import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomerRuntime,
  customerRequestUrl,
  loadCustomerRouteGates,
  loadCustomerRuntimeOrigin,
  loadPrivateCheckoutFixtureEnabled,
} from "./customer-http.js";

const response = (name: string) => async (): Promise<Response> => new Response(name, { status: 200 });

test("customer routes are disabled by default", async () => {
  const gates = loadCustomerRouteGates({});
  assert.deepEqual(gates, { checkoutEnabled: false, paymentWebhooksEnabled: false });
  const runtime = createCustomerRuntime({ checkout: response("checkout"), paymentWebhook: response("webhook"), readiness: async () => {}, gates });
  assert.equal((await runtime(new Request("https://example.test/checkout", { method: "POST" }))).status, 404);
  assert.equal((await runtime(new Request("https://example.test/webhooks/mollie", { method: "POST" }))).status, 404);
});

test("checkout and payment webhook exposure are independent", async () => {
  const checkoutRuntime = createCustomerRuntime({
    checkout: response("checkout"), paymentWebhook: response("webhook"), readiness: async () => {},
    gates: { checkoutEnabled: true, paymentWebhooksEnabled: false },
  });
  assert.equal(await (await checkoutRuntime(new Request("https://example.test/checkout", { method: "POST" }))).text(), "checkout");
  assert.equal((await checkoutRuntime(new Request("https://example.test/webhooks/mollie", { method: "POST" }))).status, 404);

  const webhookRuntime = createCustomerRuntime({
    checkout: response("checkout"), paymentWebhook: response("webhook"), readiness: async () => {},
    gates: { checkoutEnabled: false, paymentWebhooksEnabled: true },
  });
  assert.equal((await webhookRuntime(new Request("https://example.test/checkout", { method: "POST" }))).status, 404);
  assert.equal(await (await webhookRuntime(new Request("https://example.test/webhooks/mollie", { method: "POST" }))).text(), "webhook");
});

test("customer runtime exposes only generic health and readiness routes", async () => {
  const runtime = createCustomerRuntime({
    checkout: response("checkout"), paymentWebhook: response("webhook"), readiness: async () => {},
    gates: { checkoutEnabled: false, paymentWebhooksEnabled: false },
  });
  assert.equal((await runtime(new Request("https://example.test/health"))).status, 200);
  assert.equal((await runtime(new Request("https://example.test/ready"))).status, 200);
  assert.equal((await runtime(new Request("https://example.test/operations/orders"))).status, 404);
  assert.equal((await runtime(new Request("https://example.test/products"))).status, 404);
});

test("customer readiness fails closed without diagnostic disclosure", async () => {
  const runtime = createCustomerRuntime({
    checkout: response("checkout"), paymentWebhook: response("webhook"),
    readiness: async () => { throw new Error("database credential detail"); },
    gates: { checkoutEnabled: false, paymentWebhooksEnabled: false },
  });
  const result = await runtime(new Request("https://example.test/ready"));
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { status: "unavailable" });
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("x-frame-options"), "DENY");
});

test("invalid route gate values fail closed at startup", () => {
  assert.throws(() => loadCustomerRouteGates({ CHECKOUT_HTTP_ENABLED: "yes" }), /must be either true or false/);
  assert.throws(() => loadCustomerRouteGates({ PAYMENT_WEBHOOKS_ENABLED: "TRUE" }), /must be either true or false/);
});

test("private checkout fixture access is disabled by default and requires the complete test boundary", () => {
  assert.equal(loadPrivateCheckoutFixtureEnabled({}), false);
  assert.equal(loadPrivateCheckoutFixtureEnabled({
    PRIVATE_CHECKOUT_FIXTURE_ENABLED: "true",
    CHECKOUT_HTTP_ENABLED: "true",
    COMMERCE_ENABLED: "true",
    PAYMENT_PROVIDER: "mollie-test",
    FULFILMENT_MODE: "test",
    FULFILMENT_PROVIDER: "manual-test",
  }), true);
  assert.throws(
    () => loadPrivateCheckoutFixtureEnabled({ PRIVATE_CHECKOUT_FIXTURE_ENABLED: "true" }),
    /requires reviewed test configuration/,
  );
  assert.throws(
    () => loadPrivateCheckoutFixtureEnabled({ PRIVATE_CHECKOUT_FIXTURE_ENABLED: "TRUE" }),
    /must be either true or false/,
  );
});

test("customer request URLs use only the configured public HTTPS origin", () => {
  const origin = loadCustomerRuntimeOrigin({ CUSTOMER_RUNTIME_ORIGIN: "https://commerce-api.example" });
  assert.equal(origin, "https://commerce-api.example");
  assert.equal(customerRequestUrl(origin, "/webhooks/mollie?id=one"), "https://commerce-api.example/webhooks/mollie?id=one");
  assert.throws(() => loadCustomerRuntimeOrigin({ CUSTOMER_RUNTIME_ORIGIN: "http://commerce-api.example" }), /HTTPS origin/);
  assert.throws(() => loadCustomerRuntimeOrigin({ CUSTOMER_RUNTIME_ORIGIN: "https://commerce-api.example/path" }), /HTTPS origin/);
  assert.throws(() => customerRequestUrl(origin, "https://attacker.example/webhook"), /configured customer origin/);
});
