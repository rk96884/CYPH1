import assert from "node:assert/strict";
import test from "node:test";
import { loadCheckoutProbeConfig, runCheckoutAdmissionProbe } from "./check-checkout-admission-capacity.mjs";

const env = {
  CHECKOUT_PROBE_CONFIRM: "synthetic-malformed-no-payment",
  CHECKOUT_PROBE_ORIGIN: "https://commerce.example/",
  CHECKOUT_PROBE_STOREFRONT_ORIGIN: "https://store.example/",
};

test("checkout probe configuration fails closed and remains tightly bounded", () => {
  assert.throws(() => loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_CONFIRM: "yes" }), /exactly synthetic-malformed-no-payment/);
  assert.throws(() => loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_ORIGIN: "http://commerce.example" }), /credential-free HTTPS/);
  assert.throws(() => loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_REQUESTS: "41" }), /2 to 40/);
  assert.throws(() => loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_CONCURRENCY: "6" }), /1 to 5/);
});

test("checkout probe accepts only controlled validation and limiter responses", async () => {
  let calls = 0;
  const result = await runCheckoutAdmissionProbe({
    config: loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_REQUESTS: "6", CHECKOUT_PROBE_CONCURRENCY: "2" }),
    fetchImpl: async (_url, init) => {
      assert.equal(init.method, "POST");
      assert.equal(init.body, "{}");
      assert.equal(init.headers.Origin, "https://store.example");
      const limited = calls++ >= 4;
      return Response.json(
        { message: limited ? "Checkout is temporarily busy." : "Invalid request." },
        { status: limited ? 429 : 400, headers: limited ? { "Retry-After": "2" } : {} },
      );
    },
  });
  assert.equal(result.requests, 6);
  assert.equal(result.admittedValidationResponses, 4);
  assert.equal(result.limitedResponses, 2);
  assert.equal(result.peakConcurrency, 2);
});

test("checkout probe rejects any success or unexpected error response", async () => {
  await assert.rejects(
    runCheckoutAdmissionProbe({
      config: loadCheckoutProbeConfig({ ...env, CHECKOUT_PROBE_REQUESTS: "2" }),
      fetchImpl: async () => Response.json({ ok: true }, { status: 200 }),
    }),
    /2 unexpected responses/,
  );
});
