import assert from "node:assert/strict";
import test from "node:test";
import type pg from "pg";
import { PaymentProviderError, type PaymentProvider } from "../../../../packages/commerce-core/src/index.js";
import { PostgresOperationsRepository } from "./postgres.js";
import { PostgresFulfilmentRepository } from "../fulfilment/postgres.js";
import { OperationsService, type CaptureResult } from "./service.js";
import { createProtectedOperationsHandler } from "../access/protected-operations.js";
import { createCloudflareAccessAuthenticator, loadCloudflareAccessConfig } from "../access/cloudflare-access.js";

// Stateful SQL test double exercises the real repositories and their transaction boundaries.
// It deliberately rejects unknown SQL so state-changing queries cannot silently pass.
function fixture() {
  const state = { payment: "authorised", order: "pending_payment", calls: 0, commits: 0, outbox: 0, audits: [] as unknown[][],
    commands: new Map<string, { command_type: string; request_fingerprint: string; status: string; result: Record<string, unknown> }>() };
  const query = async (sql: string, args: unknown[] = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    const rows = (values: Record<string, unknown>[]) => ({ rowCount: values.length, rows: values });
    if (["BEGIN", "ROLLBACK"].includes(s) || s.startsWith("SELECT pg_advisory")) return rows([]);
    if (s === "COMMIT") { state.commits++; return rows([]); }
    if (s.startsWith("SELECT command_type") || s.startsWith("SELECT status, result FROM operator_commands")) {
      const c = state.commands.get(String(args[0])); return rows(c ? [c] : []);
    }
    if (s.startsWith("SELECT id, provider, provider_payment_id")) return rows([{ id: "p1", provider: "mollie-test", provider_payment_id: "tr_1", status: state.payment, amount_minor: "1000", currency: "GBP" }]);
    if (s.startsWith("SELECT status, total_minor")) return rows([{ status: state.order, total_minor: "1000", currency: "GBP" }]);
    if (s.startsWith("INSERT INTO operator_commands")) {
      if (state.commands.size) return rows([]);
      state.commands.set(String(args[0]), { command_type: "payment.capture", request_fingerprint: String(args[3]), status: "reserved", result: JSON.parse(String(args[4])) });
      return rows([{ id: "c1" }]);
    }
    if (s.startsWith("INSERT INTO audit_events")) { state.audits.push(args); return rows([]); }
    if (s.startsWith("SELECT status FROM payments")) return rows([{ status: state.payment }]);
    if (s.startsWith("SELECT status FROM orders")) return rows([{ status: state.order }]);
    if (s.startsWith("UPDATE payments SET status")) { state.payment = String(args[1]); return rows([]); }
    if (s.startsWith("UPDATE orders SET status")) { state.order = String(args[1]); return rows([]); }
    if (s.startsWith("INSERT INTO outbox_events")) { state.outbox++; return rows([]); }
    if (s.startsWith("UPDATE operator_commands SET status")) {
      const c = state.commands.get(String(args[0]))!; c.status = String(args[1]); c.result = JSON.parse(String(args[2])); return rows([]);
    }
    if (s.startsWith("SELECT o.id, o.order_number")) {
      assert.match(s, /p.status = 'captured'/);
      return rows([{ id: "o1", order_number: "C1", status: state.order, captured: state.payment === "captured", delivery_address_snapshot: {} }]);
    }
    if (s.startsWith("SELECT COALESCE(p.fulfilment_sku")) return rows([{ sku: "test", quantity: 1 }]);
    if (s.startsWith("INSERT INTO fulfilments")) return rows([{ id: "f1" }]);
    if (s.startsWith("UPDATE orders SET fulfilment_status")) return rows([]);
    throw new Error(`Unexpected SQL: ${s}`);
  };
  const pool = { connect: async () => ({ query, release() {} }) } as unknown as pg.Pool;
  const repository = new PostgresOperationsRepository(pool);
  let capture: NonNullable<PaymentProvider["capture"]> = async (input) => ({ provider: "mollie-test", providerPaymentId: input.providerPaymentId, providerCaptureId: "cpt_1", amount: input.amount, status: "completed", createdAt: "2026-09-28T00:00:00Z" });
  const unused = async (): Promise<never> => { throw new Error("unused"); };
  const provider: PaymentProvider = { key: "mollie-test", createCheckout: unused, getPayment: unused, refund: unused, verifyWebhook: unused, normaliseWebhook: unused,
    capture: async (input) => {
      assert.ok(state.commits > 0, "reservation committed before contacting provider");
      assert.equal(state.commands.get(input.idempotencyKey)?.status, "reserved");
      assert.equal(input.operatorId, "operator@example.test"); assert.ok(input.correlationId);
      assert.deepEqual(input.amount, input.authorisedAmount);
      state.calls++; return capture(input);
    } };
  const service = new OperationsService(repository, { getProvider: () => provider, getConfiguredProvider: () => provider });
  const config = loadCloudflareAccessConfig({ CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUDIENCE: "test",
    OPERATIONS_ACCESS_GRANTS: JSON.stringify({ "operator@example.test": ["payments:capture"], "viewer@example.test": ["orders:read"] }) });
  const access = createCloudflareAccessAuthenticator(config, async (token) => ({ payload: { email: token } }));
  const handler = createProtectedOperationsHandler(service, access);
  const request = (key: string | undefined = "capture-1", identity = "operator@example.test", order = "o1") => handler(new Request(`https://ops.test/operations/orders/${order}/capture`, {
    method: "POST", headers: { ...(key === undefined ? {} : { "Idempotency-Key": key }), ...(identity ? { "cf-access-jwt-assertion": identity } : {}) },
  }));
  return { state, repository, service, request, setCapture: (fn: typeof capture) => { capture = fn; }, fulfilment: new PostgresFulfilmentRepository(pool) };
}

test("protected authorised capture commits reservation, captures and releases existing fulfilment pipeline", async () => {
  const f = fixture();
  await assert.rejects(() => f.fulfilment.reservePaidOrder("o1", "test", "fulfil", "corr"), /verified captured/);
  f.state.order = "paid";
  await assert.rejects(() => f.fulfilment.reservePaidOrder("o1", "test", "fulfil", "corr"), /verified captured/);
  f.state.order = "pending_payment";
  assert.equal((await f.request()).status, 200);
  assert.equal(f.state.payment, "captured"); assert.equal(f.state.order, "paid"); assert.equal(f.state.outbox, 1);
  assert.equal((await f.fulfilment.reservePaidOrder("o1", "test", "fulfil", "corr")).outcome, "reserved");
  const audit = f.state.audits.filter((a) => String(a[2]).startsWith("capture."));
  assert.deepEqual(audit.map((a) => a[2]), ["capture.reserved", "capture.completed"]);
  assert.equal(audit[0]![3], "operator@example.test"); assert.equal(audit[0]![4], audit[1]![4]);
});

test("capture requires authenticated operator with explicit server-side grant", async () => {
  const f = fixture();
  assert.equal((await f.request("key", "")).status, 401);
  assert.equal((await f.request("key", "viewer@example.test")).status, 403);
  assert.equal(f.state.calls, 0); assert.equal(f.state.commands.size, 0);
});

test("missing and invalid capture idempotency keys fail before reservation", async () => {
  const f = fixture();
  for (const key of ["", "bad key", "a".repeat(129), "bad/key"]) assert.equal((await f.request(key)).status, 400);
  const config = createProtectedOperationsHandler(f.service, { authenticate: async () => ({ id: "operator@example.test", permissions: ["payments:capture"] }) });
  assert.equal((await config(new Request("https://ops.test/operations/orders/o1/capture", { method: "POST" }))).status, 400);
  assert.equal(f.state.calls, 0); assert.equal(f.state.commands.size, 0);
});

test("capture rejects unauthorised and already captured payments", async () => {
  for (const status of ["pending", "created", "captured", "failed", "resolution_required", "cancelled", "expired"]) {
    const f = fixture(); f.state.payment = status;
    assert.equal((await f.request()).status, 409); assert.equal(f.state.calls, 0);
  }
});

test("capture replay returns saved result; conflicting key and replacement command never recapture", async () => {
  const f = fixture(); const first = await (await f.request()).json();
  assert.deepEqual(await (await f.request()).json(), first);
  assert.equal((await f.request("capture-1", "operator@example.test", "o2")).status, 409);
  assert.equal((await f.request("replacement")).status, 409); assert.equal(f.state.calls, 1);
});

test("in-flight capture replay is blocked before a second provider call", async () => {
  const f = fixture();
  f.setCapture(async (input) => {
    assert.equal((await f.request()).status, 409);
    assert.equal((await f.request("replacement")).status, 409);
    return { provider: "mollie-test", providerPaymentId: input.providerPaymentId, providerCaptureId: "cpt_1", amount: input.amount, status: "completed", createdAt: "now" };
  });
  assert.equal((await f.request()).status, 200); assert.equal(f.state.calls, 1);
});

for (const scenario of ["declined", "retryable", "unknown", "pending", "failed", "mismatch"] as const) {
  test(`capture ${scenario} outcome is durable and never retried`, async () => {
    const f = fixture();
    f.setCapture(async (input) => {
      if (scenario === "declined") throw new PaymentProviderError("payment_declined", "private provider payload");
      if (scenario === "retryable") throw new PaymentProviderError("network_error", "private provider payload", true);
      if (scenario === "unknown") throw new Error("private provider payload");
      return { provider: "mollie-test", providerPaymentId: scenario === "mismatch" ? "wrong" : input.providerPaymentId, providerCaptureId: "cpt_1", amount: input.amount, status: scenario === "mismatch" ? "completed" : scenario, createdAt: "now" };
    });
    const status: CaptureResult["status"] = ["declined", "failed"].includes(scenario) ? "failed" : "resolution_required";
    const response = await f.request(); const result = await response.json() as CaptureResult;
    assert.equal(result.status, status); assert.equal(response.status, status === "failed" ? 502 : 202);
    assert.equal(f.state.order, "pending_payment"); assert.notEqual(f.state.payment, "captured"); assert.equal(f.state.outbox, 0);
    assert.deepEqual(await (await f.request()).json(), result);
    assert.equal((await f.request("replacement")).status, 409); assert.equal(f.state.calls, 1);
    assert.doesNotMatch(JSON.stringify(f.state.audits), /private provider payload/);
    await assert.rejects(() => f.fulfilment.reservePaidOrder("o1", "test", "fulfil", "corr"), /verified captured/);
  });
}

test("capture persistence failure retains reservation and blocks replay", async () => {
  const f = fixture(); f.repository.finishCapture = async () => { throw new Error("database unavailable"); };
  assert.equal((await f.request()).status, 500);
  assert.equal((await f.request()).status, 409); assert.equal((await f.request("replacement")).status, 409);
  assert.equal(f.state.calls, 1); assert.equal(f.state.order, "pending_payment");
});
