import assert from "node:assert/strict";
import test from "node:test";
import { handleOperationsRequest } from "../operations/handler.js";
import type { OperationsPrincipal, OperationsService } from "../operations/service.js";
import { PostgresGrowthProspectReader, type GrowthProspectReader } from "./read-prospects.js";

const path = "https://ops.invalid/operations/growth/prospects";
const sample = { id: "7e7e", channel: "creator", display_name: "Example", source_url: "https://example.org",
  source_checked_at: new Date("2026-11-03T00:00:00Z"), review_status: "research_only",
  qualification_score: 70, qualification_confidence: "0.800", evidence_count: 4 };
const reader: GrowthProspectReader = {
  list: async () => [{ id: "1", channel: "creator", name: "Example", sourceUrl: "https://example.org",
    checkedAt: "2026-11-03T00:00:00Z", status: "research_only", score: 70, confidence: 0.8, evidenceCount: 4 }]
};
const fakeService = {} as OperationsService;
const principal = (permissions: OperationsPrincipal["permissions"]): OperationsPrincipal =>
  ({ id: "owner@example.test", permissions });

test("growth endpoint denies absent authentication and insufficient grants", async () => {
  const unauthorized = await handleOperationsRequest(new Request(path), fakeService, undefined, undefined, undefined, reader);
  assert.equal(unauthorized.status, 401);
  const denied = await handleOperationsRequest(new Request(path), fakeService, principal(["orders:read"]), undefined, undefined, reader);
  assert.equal(denied.status, 403);
});

test("growth endpoint accepts only GET with growth:read", async () => {
  const p = principal(["growth:read"]);
  const method = await handleOperationsRequest(new Request(path, { method: "POST" }), fakeService, p, undefined, undefined, reader);
  assert.equal(method.status, 405);
  const invalid = await handleOperationsRequest(new Request(path + "?channel=consumer"), fakeService, p, undefined, undefined, reader);
  assert.equal(invalid.status, 400);
  const success = await handleOperationsRequest(new Request(path + "?channel=creator"), fakeService, p, undefined, undefined, reader);
  assert.equal(success.status, 200);
  const body = await success.json() as { prospects: unknown[]; readOnly: boolean };
  assert.equal(body.prospects.length, 1);
  assert.equal(body.readOnly, true);
  assert.equal(success.headers.get("cache-control"), "no-store");
});

test("reader bounds results and selects only noncontact columns", async () => {
  let sql = "", params: readonly unknown[] = [];
  const mockPool = { query: async (query: string, args: unknown[]) => {
    sql = query; params = args;
    return { rows: [sample] };
  } };
  const repository = new PostgresGrowthProspectReader(mockPool as unknown as ConstructorParameters<typeof PostgresGrowthProspectReader>[0]);
  const rows = await repository.list("creator");
  assert.match(sql, /LIMIT 100/);
  assert.match(sql, /growth\.prospects/);
  assert.deepEqual(params, ["creator"]);
  assert.deepEqual(rows[0], { id: "7e7e", channel: "creator", name: "Example", sourceUrl: "https://example.org",
    checkedAt: "2026-11-03T00:00:00.000Z", status: "research_only", score: 70, confidence: 0.8, evidenceCount: 4 });
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "email"), false);
});
