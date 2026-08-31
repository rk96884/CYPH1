import assert from "node:assert/strict";
import test from "node:test";
import { checkCommerceStaging, parseStagingOrigin } from "./check-commerce-staging.mjs";

test("staging origin must be an HTTPS origin without credentials or path data", () => {
  assert.equal(parseStagingOrigin("https://staging.example").origin, "https://staging.example");
  for (const value of [
    "http://staging.example",
    "https://user:secret@staging.example",
    "https://staging.example/path",
    "https://staging.example?secret=value",
  ]) assert.throws(() => parseStagingOrigin(value));
});

test("health and readiness require exact successful generic responses", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url.pathname);
    return Response.json({ status: url.pathname === "/health" ? "ok" : "ready" });
  };
  assert.deepEqual(
    await checkCommerceStaging({ origin: new URL("https://staging.example"), fetchImpl }),
    [{ endpoint: "health", status: 200 }, { endpoint: "readiness", status: 200 }],
  );
  assert.deepEqual(requested, ["/health", "/ready"]);
});

test("a failed or unexpected response rejects the check", async () => {
  await assert.rejects(
    checkCommerceStaging({
      origin: new URL("https://staging.example"),
      fetchImpl: async () => Response.json({ status: "unavailable" }, { status: 503 }),
    }),
    /health check returned HTTP 503/,
  );
  await assert.rejects(
    checkCommerceStaging({
      origin: new URL("https://staging.example"),
      fetchImpl: async () => Response.json({ status: "wrong" }),
    }),
    /health check returned an unexpected response/,
  );
});
