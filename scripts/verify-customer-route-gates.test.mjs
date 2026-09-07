import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomerRuntimeOrigin,
  parseRouteGateMode,
  verifyCustomerRouteGates,
} from "./verify-customer-route-gates.mjs";

const responseFor = (status) => Response.json(
  status === 404 ? { message: "Not found." } : { message: "Method not allowed." },
  { status, headers: { "Cache-Control": "no-store", ...(status === 405 ? { Allow: "POST" } : {}) } },
);

test("customer origin must be an HTTPS origin without path data", () => {
  assert.equal(parseCustomerRuntimeOrigin("https://commerce-staging.example").origin, "https://commerce-staging.example");
  for (const value of [
    "http://commerce-staging.example",
    "https://user:secret@commerce-staging.example",
    "https://commerce-staging.example/path",
    "https://commerce-staging.example?token=value",
  ]) assert.throws(() => parseCustomerRuntimeOrigin(value));
});

test("route-gate mode accepts only the three deliberate states", () => {
  for (const mode of ["disabled", "active", "contained"]) assert.equal(parseRouteGateMode(mode), mode);
  for (const mode of [undefined, "", "enabled", "CONTAINED"]) assert.throws(() => parseRouteGateMode(mode));
});

test("disabled mode requires both commerce routes to be absent", async () => {
  const requested = [];
  const fetchImpl = async (url) => { requested.push(url.pathname); return responseFor(404); };
  assert.deepEqual(
    await verifyCustomerRouteGates({ origin: new URL("https://commerce-staging.example"), mode: "disabled", fetchImpl }),
    [{ endpoint: "checkout", status: 404 }, { endpoint: "payment webhook", status: 404 }],
  );
  assert.deepEqual(requested, ["/checkout", "/webhooks/mollie"]);
});

test("contained mode requires checkout absent and webhook route reachable", async () => {
  const fetchImpl = async (url) => responseFor(url.pathname === "/checkout" ? 404 : 405);
  assert.deepEqual(
    await verifyCustomerRouteGates({ origin: new URL("https://commerce-staging.example"), mode: "contained", fetchImpl }),
    [{ endpoint: "checkout", status: 404 }, { endpoint: "payment webhook", status: 405 }],
  );
});

test("active mode requires both routes to advertise their POST boundary", async () => {
  assert.deepEqual(
    await verifyCustomerRouteGates({
      origin: new URL("https://commerce-staging.example"), mode: "active", fetchImpl: async () => responseFor(405),
    }),
    [{ endpoint: "checkout", status: 405 }, { endpoint: "payment webhook", status: 405 }],
  );
});

test("unexpected status, body or headers fail verification", async () => {
  const input = { origin: new URL("https://commerce-staging.example"), mode: "contained" };
  await assert.rejects(
    verifyCustomerRouteGates({ ...input, fetchImpl: async () => responseFor(405) }),
    /checkout returned HTTP 405; expected 404/,
  );
  await assert.rejects(
    verifyCustomerRouteGates({ ...input, fetchImpl: async () => Response.json({ message: "wrong" }, { status: 404, headers: { "Cache-Control": "no-store" } }) }),
    /unexpected response/,
  );
  await assert.rejects(
    verifyCustomerRouteGates({ ...input, fetchImpl: async (url) => url.pathname === "/checkout"
      ? responseFor(404)
      : Response.json({ message: "Method not allowed." }, { status: 405, headers: { "Cache-Control": "no-store" } }) }),
    /advertise only POST/,
  );
});
