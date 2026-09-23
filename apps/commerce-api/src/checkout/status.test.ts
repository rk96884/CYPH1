import assert from "node:assert/strict";
import test from "node:test";
import { handleOrderStatusRequest } from "./status.js";

const orderId = "123e4567-e89b-42d3-a456-426614174000";

test("order status exposes only a coarse public state", async () => {
  const repository = { async getPublicState() { return "paid" as const; } };
  const response = await handleOrderStatusRequest(
    new Request(`https://api.example/orders/${orderId}/status`, { headers: { Origin: "https://preview.example" } }),
    repository,
    "https://preview.example",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { state: "paid" });
  assert.equal(response.headers.get("access-control-allow-origin"), "https://preview.example");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("order status rejects invalid ids, unknown orders, methods and origins", async () => {
  let calls = 0;
  const repository = { async getPublicState() { calls += 1; return undefined; } };
  assert.equal((await handleOrderStatusRequest(new Request("https://api.example/orders/not-a-uuid/status"), repository, "https://preview.example")).status, 404);
  assert.equal(calls, 0);
  assert.equal((await handleOrderStatusRequest(new Request(`https://api.example/orders/${orderId}/status`), repository, "https://preview.example")).status, 404);
  assert.equal(calls, 1);
  assert.equal((await handleOrderStatusRequest(new Request(`https://api.example/orders/${orderId}/status`, { method: "POST" }), repository, "https://preview.example")).status, 405);
  assert.equal((await handleOrderStatusRequest(new Request(`https://api.example/orders/${orderId}/status`, { headers: { Origin: "https://evil.example" } }), repository, "https://preview.example")).status, 403);
});
