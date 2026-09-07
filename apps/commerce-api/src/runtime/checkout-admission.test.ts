import assert from "node:assert/strict";
import test from "node:test";
import {
  CheckoutAdmissionController,
  loadCheckoutAdmissionConfig,
  withCheckoutAdmission,
} from "./checkout-admission.js";

test("checkout admission configuration is explicit and bounded", () => {
  assert.deepEqual(loadCheckoutAdmissionConfig({
    CHECKOUT_ADMISSION_MAX_CONCURRENT: "4",
    CHECKOUT_ADMISSION_WINDOW_REQUESTS: "30",
    CHECKOUT_ADMISSION_WINDOW_SECONDS: "60",
  }), { maximumConcurrent: 4, windowRequests: 30, windowMilliseconds: 60_000 });
  for (const environment of [
    {},
    { CHECKOUT_ADMISSION_MAX_CONCURRENT: "0", CHECKOUT_ADMISSION_WINDOW_REQUESTS: "30", CHECKOUT_ADMISSION_WINDOW_SECONDS: "60" },
    { CHECKOUT_ADMISSION_MAX_CONCURRENT: "4", CHECKOUT_ADMISSION_WINDOW_REQUESTS: "lots", CHECKOUT_ADMISSION_WINDOW_SECONDS: "60" },
    { CHECKOUT_ADMISSION_MAX_CONCURRENT: "4", CHECKOUT_ADMISSION_WINDOW_REQUESTS: "30", CHECKOUT_ADMISSION_WINDOW_SECONDS: "3601" },
  ]) assert.throws(() => loadCheckoutAdmissionConfig(environment));
});

test("rolling-window admission returns a bounded retry interval", () => {
  let now = 10_000;
  const controller = new CheckoutAdmissionController({
    maximumConcurrent: 2, windowRequests: 2, windowMilliseconds: 5_000,
  }, () => now);
  const first = controller.acquire();
  const second = controller.acquire();
  if (first.admitted) first.release();
  if (second.admitted) second.release();
  assert.deepEqual(controller.acquire(), { admitted: false, retryAfterSeconds: 5 });
  now = 15_001;
  assert.equal(controller.acquire().admitted, true);
});

test("concurrent checkout work is capped and release is idempotent", () => {
  const controller = new CheckoutAdmissionController({
    maximumConcurrent: 1, windowRequests: 10, windowMilliseconds: 60_000,
  });
  const first = controller.acquire();
  assert.equal(first.admitted, true);
  assert.deepEqual(controller.acquire(), { admitted: false, retryAfterSeconds: 1 });
  if (first.admitted) { first.release(); first.release(); }
  assert.equal(controller.acquire().admitted, true);
});

test("wrapper limits POST only and preserves approved CORS without exposing thresholds", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  const handler = async () => { await pending; return new Response("handled"); };
  const controller = new CheckoutAdmissionController({
    maximumConcurrent: 1, windowRequests: 10, windowMilliseconds: 60_000,
  });
  const wrapped = withCheckoutAdmission(handler, controller, "https://storefront.example");
  const first = wrapped(new Request("https://api.example/checkout", {
    method: "POST", headers: { Origin: "https://storefront.example" },
  }));
  const limited = await wrapped(new Request("https://api.example/checkout", {
    method: "POST", headers: { Origin: "https://storefront.example" },
  }));
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { message: "Checkout is temporarily busy." });
  assert.equal(limited.headers.get("retry-after"), "1");
  assert.equal(limited.headers.get("access-control-allow-origin"), "https://storefront.example");
  assert.equal(limited.headers.get("x-ratelimit-limit"), null);
  resolve();
  assert.equal(await (await first).text(), "handled");

  const getResponse = await wrapped(new Request("https://api.example/checkout"));
  assert.equal(getResponse.status, 200);
});

test("wrapper releases admission when the checkout handler fails", async () => {
  let calls = 0;
  const controller = new CheckoutAdmissionController({
    maximumConcurrent: 1, windowRequests: 10, windowMilliseconds: 60_000,
  });
  const wrapped = withCheckoutAdmission(async () => {
    calls += 1;
    if (calls === 1) throw new Error("expected test failure");
    return new Response("recovered");
  }, controller, "https://storefront.example");
  await assert.rejects(wrapped(new Request("https://api.example/checkout", { method: "POST" })));
  assert.equal(await (await wrapped(new Request("https://api.example/checkout", { method: "POST" }))).text(), "recovered");
});
