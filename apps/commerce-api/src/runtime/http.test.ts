import assert from "node:assert/strict";
import { test } from "node:test";
import { createOperationsRuntime, requestHeaders } from "./http.js";

test("runtime exposes only generic health and readiness responses", async () => {
  let operationsCalls = 0;
  const runtime = createOperationsRuntime(async () => {
    operationsCalls += 1;
    return new Response("protected");
  }, async () => undefined);
  const health = await runtime(new Request("https://runtime.invalid/health"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("cache-control"), "no-store");
  const ready = await runtime(new Request("https://runtime.invalid/ready"));
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ready" });
  const missing = await runtime(new Request("https://runtime.invalid/checkout"));
  assert.equal(missing.status, 404);
  assert.equal(operationsCalls, 0);
});

test("runtime forwards only operations routes to the protected handler", async () => {
  const runtime = createOperationsRuntime(async (request) =>
    new Response(request.headers.get("cf-access-jwt-assertion"), { status: 401 }), async () => undefined);
  const response = await runtime(new Request("https://runtime.invalid/operations/orders", {
    headers: { "Cf-Access-Jwt-Assertion": "verified-at-the-boundary" },
  }));
  assert.equal(response.status, 401);
  assert.equal(await response.text(), "verified-at-the-boundary");
});

test("runtime readiness fails closed without exposing database details", async () => {
  const runtime = createOperationsRuntime(async () => new Response(), async () => {
    throw new Error("private database hostname");
  });
  const response = await runtime(new Request("https://runtime.invalid/ready"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable" });
});

test("incoming header conversion preserves repeated values", () => {
  const headers = requestHeaders({ "cf-access-jwt-assertion": "token", "x-example": ["one", "two"] });
  assert.equal(headers.get("cf-access-jwt-assertion"), "token");
  assert.equal(headers.get("x-example"), "one, two");
});

