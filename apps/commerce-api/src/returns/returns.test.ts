import assert from "node:assert/strict";
import test from "node:test";
import { ReturnService, type ReturnCommand, type ReturnRepository, type ReturnRecord } from "./service.js";
import { handleOperationsRequest } from "../operations/handler.js";
import type { OperationsService, OperationPermission } from "../operations/service.js";
import { loadCloudflareAccessConfig } from "../access/cloudflare-access.js";
import { ReturnDomainError } from "../../../../packages/commerce-core/src/index.js";
const orderId = "00000000-0000-0000-0000-000000000001";
const itemId = "00000000-0000-0000-0000-000000000002";
const returnId = "00000000-0000-0000-0000-000000000003";
const requestBody = { category: "fault_reported", items: [{ orderItemId: itemId, quantity: 1 }] };
const approval = { expectedVersion: 1, approvedRefundMinor: 0, receiptRequired: false, receiptWaiverReason: "operator_waiver", items: requestBody.items };
function fixture() {
  const commands: ReturnCommand[] = []; let reads = 0;
  const repository: ReturnRepository = { execute: async (command) => { commands.push(command); return { id: returnId, status: "requested" } as ReturnRecord; }, list: async () => { reads++; return []; } };
  const returns = new ReturnService(repository);
  const operations = { refund: () => { assert.fail("No refunds in Phase 1"); } } as unknown as OperationsService;
  const send = (path: string, body: unknown, permissions: readonly OperationPermission[], key = "return-command", method = "POST") => handleOperationsRequest(new Request(`https://ops.test/operations/orders/${orderId}/returns${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": key }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) }), operations, { id: "operator", permissions }, returns);
  return { commands, returns, send, reads: () => reads };
}
test("returns manage can request, receive, inspect and cancel without refund authority", async () => {
  const f = fixture(); assert.equal((await f.send("", requestBody, ["returns:manage"])).status, 201);
  for (const [action, body] of [["receive", { expectedVersion: 2, items: requestBody.items }], ["inspect", { expectedVersion: 3, outcome: "inconclusive" }], ["cancel", { expectedVersion: 1, reason: "request_withdrawn" }]] as const) assert.equal((await f.send(`/${returnId}/${action}`, body, ["returns:manage"])).status, 200);
  assert.equal(f.commands.length, 4);
  assert.ok(f.commands.every((command) => command.operatorId === "operator" && /^[0-9a-f-]{36}$/.test(command.correlationId)));
});
test("returns approve permits explicit approval, rejection and closure only", async () => {
  const f = fixture(); assert.equal((await f.send(`/${returnId}/approve`, approval, ["returns:approve"])).status, 200);
  assert.equal((await f.send(`/${returnId}/reject`, { expectedVersion: 1, reason: "not_approved" }, ["returns:approve"])).status, 200);
  assert.equal((await f.send(`/${returnId}/close`, { expectedVersion: 3 }, ["returns:approve"])).status, 200);
  assert.equal((await f.send("", requestBody, ["returns:approve"])).status, 403);
});
test("negative return permissions do not broaden refunds create", async () => {
  const f = fixture();
  for (const permissions of [[], ["orders:read"], ["refunds:create"]] as OperationPermission[][]) assert.equal((await f.send("", requestBody, permissions)).status, 403);
  for (const action of ["approve", "reject", "close"]) assert.equal((await f.send(`/${returnId}/${action}`, approval, ["returns:manage"])).status, 403);
  for (const action of ["receive", "inspect", "cancel"]) assert.equal((await f.send(`/${returnId}/${action}`, {}, ["returns:approve"])).status, 403);
  const refundResponse = await handleOperationsRequest(new Request(`https://ops.test/operations/orders/${orderId}/refunds`, { method: "POST" }), {} as OperationsService, { id: "operator", permissions: ["returns:manage", "returns:approve"] }, f.returns);
  assert.equal(refundResponse.status, 403); assert.equal(f.commands.length, 0);
});
test("orders read controls return projection and authentication remains mandatory", async () => {
  const f = fixture(); assert.equal((await f.send("", {}, ["orders:read"], "key", "GET")).status, 200); assert.equal(f.reads(), 1);
  assert.equal((await f.send("", {}, ["returns:manage"], "key", "GET")).status, 403);
  const response = await handleOperationsRequest(new Request(`https://ops.test/operations/orders/${orderId}/returns`), {} as OperationsService, undefined, f.returns); assert.equal(response.status, 401);
});
test("return input rejects narratives, invalid categories, identifiers and quantities", async () => {
  const f = fixture();
  for (const body of [null, { ...requestBody, notes: "customer email health narrative" }, { ...requestBody, category: "defective" }, { category: "other", items: [] }, { category: "other", items: [{ orderItemId: "bad", quantity: 1 }] }, ...[0, -1, 0.5, "1"].map((quantity) => ({ category: "other", items: [{ orderItemId: itemId, quantity }] })), { category: "other", items: [requestBody.items[0], requestBody.items[0]] }]) assert.equal((await f.send("", body, ["returns:manage"])).status, 400);
  assert.equal(f.commands.length, 0);
});
test("approval requires controlled explicit money and receipt decisions, with version fencing", async () => {
  const f = fixture();
  for (const body of [{ ...approval, approvedRefundMinor: -1 }, { ...approval, approvedRefundMinor: 0.5 }, { ...approval, approvedRefundMinor: "100" }, { ...approval, expectedVersion: 0 }, { ...approval, receiptWaiverReason: "policy invented" }, { ...approval, receiptRequired: true }, { expectedVersion: 1 }]) assert.equal((await f.send(`/${returnId}/approve`, body, ["returns:approve"])).status, 400);
  assert.equal(f.commands.length, 0);
});
test("missing or invalid return idempotency keys fail before repository mutation", async () => {
  const f = fixture(); for (const key of ["", "bad key", "x".repeat(129)]) assert.equal((await f.send("", requestBody, ["returns:manage"], key)).status, 400);
  assert.equal(f.commands.length, 0);
});
test("approval cannot supply currency, narratives or silently approve zero total units", async () => {
  const f = fixture();
  for (const body of [{ ...approval, currency: "EUR" }, { ...approval, notes: "customer narrative" }, { ...approval, items: [{ orderItemId: itemId, quantity: 0 }] }]) {
    assert.equal((await f.send(`/${returnId}/approve`, body, ["returns:approve"])).status, 400);
  }
  assert.equal(f.commands.length, 0);
});

test("Access accepts both canonical return permissions without widening arbitrary grants", () => {
  const config = loadCloudflareAccessConfig({ CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUDIENCE: "test", OPERATIONS_ACCESS_GRANTS: JSON.stringify({ "operator@example.test": ["returns:manage", "returns:approve"] }) });
  assert.deepEqual(config.grants.get("operator@example.test"), ["returns:manage", "returns:approve"]);
});

test("closure ownership and lock conflicts produce controlled responses", async () => {
  for (const message of ["The linked refund relationship requires resolution before closure.", "The return command conflicts with another action."]) {
    const repository: ReturnRepository = { list: async () => [], execute: async () => { throw new ReturnDomainError("conflict", message); } };
    const response = await handleOperationsRequest(new Request(`https://ops.test/operations/orders/${orderId}/returns/${returnId}/close`, {
      method: "POST", headers: { "Idempotency-Key": "close-safe" }, body: JSON.stringify({ expectedVersion: 1 }),
    }), {} as OperationsService, { id: "operator", permissions: ["returns:approve"] }, new ReturnService(repository));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { message, code: "conflict" });
  }
});
