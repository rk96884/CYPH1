import assert from "node:assert/strict";
import test from "node:test";
import { classifyRuntimeRoute, createRuntimeRequestLog } from "./observability.js";

test("runtime routes use bounded labels", () => {
  assert.equal(classifyRuntimeRoute("/health"), "health");
  assert.equal(classifyRuntimeRoute("/ready"), "readiness");
  assert.equal(classifyRuntimeRoute("/operations/orders/secret-order-id"), "operations");
  assert.equal(classifyRuntimeRoute("/unexpected/private-value"), "unknown");
});

test("structured request logs omit paths, queries, headers and identities", () => {
  const entry = createRuntimeRequestLog({
    requestId: "request-123",
    method: "GET",
    pathname: "/operations/orders/customer@example.test?token=secret",
    status: 403,
    durationMs: 12.6,
    now: new Date("2026-08-31T12:00:00.000Z"),
  });
  assert.deepEqual(entry, {
    timestamp: "2026-08-31T12:00:00.000Z",
    level: "warn",
    event: "operations_http_request",
    requestId: "request-123",
    method: "GET",
    route: "operations",
    status: 403,
    outcome: "client_error",
    durationMs: 13,
  });
  const serialised = JSON.stringify(entry);
  assert.doesNotMatch(serialised, /customer|example|token|secret|Cf-Access/i);
});

test("server failures are emitted as error outcomes", () => {
  const entry = createRuntimeRequestLog({
    requestId: "request-500",
    method: "GET",
    pathname: "/ready",
    status: 503,
    durationMs: -1,
  });
  assert.equal(entry.level, "error");
  assert.equal(entry.outcome, "server_error");
  assert.equal(entry.durationMs, 0);
});
