import assert from "node:assert/strict";
import test from "node:test";
import { handlePaymentWebhookRequest } from "./handler.js";

test("webhook handler preserves raw bytes and the receiving endpoint", async () => {
  const bytes = new TextEncoder().encode("id=tr_test%2Bexact");
  let received: { rawBody: Uint8Array; endpointUrl: string; headers: Readonly<Record<string, string>> } | undefined;
  const response = await handlePaymentWebhookRequest(new Request("https://payments.example/webhooks/mollie", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-provider-test": "present" },
    body: bytes,
  }), {
    process: async (input) => {
      received = input;
      return { acknowledgement: "processed", eventCount: 1 };
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(received?.rawBody, bytes);
  assert.equal(received?.endpointUrl, "https://payments.example/webhooks/mollie");
  assert.equal(received?.headers["x-provider-test"], "present");
});

test("webhook handler maps rejected and failed processing safely", async () => {
  const rejected = await handlePaymentWebhookRequest(new Request("https://example.test/webhooks/mollie", { method: "POST", body: "id=x" }), {
    process: async () => ({ acknowledgement: "rejected", eventCount: 0 }),
  });
  assert.equal(rejected.status, 400);
  const unavailable = await handlePaymentWebhookRequest(new Request("https://example.test/webhooks/mollie", { method: "POST", body: "id=x" }), {
    process: async () => { throw new Error("provider unavailable"); },
  });
  assert.equal(unavailable.status, 502);
  assert.equal((await unavailable.text()).includes("provider unavailable"), false);
});

test("webhook handler rejects unsupported methods and oversized bodies", async () => {
  const processor = { process: async () => ({ acknowledgement: "processed" as const, eventCount: 1 }) };
  assert.equal((await handlePaymentWebhookRequest(new Request("https://example.test/webhooks/mollie"), processor)).status, 405);
  assert.equal((await handlePaymentWebhookRequest(new Request("https://example.test/webhooks/mollie", {
    method: "POST", body: "x".repeat(2_049),
  }), processor)).status, 413);
});
