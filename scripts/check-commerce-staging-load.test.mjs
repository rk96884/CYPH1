import assert from "node:assert/strict";
import test from "node:test";
import { loadProbeConfig, runBoundedProbe } from "./check-commerce-staging-load.mjs";

const environment = {
  COMMERCE_LOAD_CONFIRM: "synthetic-read-only",
  COMMERCE_LOAD_ORIGIN: "https://commerce-staging.example/",
};

test("load probe configuration fails closed and enforces bounds", () => {
  assert.throws(() => loadProbeConfig({ ...environment, COMMERCE_LOAD_CONFIRM: "yes" }), /exactly synthetic-read-only/);
  assert.throws(() => loadProbeConfig({ ...environment, COMMERCE_LOAD_ORIGIN: "http://commerce-staging.example" }), /HTTPS origin/);
  assert.throws(() => loadProbeConfig({ ...environment, COMMERCE_LOAD_ORIGIN: "https://commerce-staging.example/path" }), /HTTPS origin/);
  assert.throws(() => loadProbeConfig({ ...environment, COMMERCE_LOAD_REQUESTS: "201" }), /2 to 200/);
  assert.throws(() => loadProbeConfig({ ...environment, COMMERCE_LOAD_CONCURRENCY: "11" }), /1 to 10/);
});

test("bounded probe checks exact health and readiness responses within configured concurrency", async () => {
  const requested = [];
  let active = 0;
  let observedPeak = 0;
  const result = await runBoundedProbe({
    config: loadProbeConfig({ ...environment, COMMERCE_LOAD_REQUESTS: "12", COMMERCE_LOAD_CONCURRENCY: "3" }),
    fetchImpl: async (url, init) => {
      assert.equal(init.method, "GET");
      active += 1;
      observedPeak = Math.max(observedPeak, active);
      requested.push(url.pathname);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return Response.json({ status: url.pathname === "/health" ? "ok" : "ready" });
    },
  });
  assert.equal(result.requests, 12);
  assert.equal(result.failures, 0);
  assert.equal(result.peakConcurrency, 3);
  assert.equal(observedPeak, 3);
  assert.deepEqual(new Set(requested), new Set(["/health", "/ready"]));
});

test("bounded probe rejects an unexpected response", async () => {
  await assert.rejects(
    runBoundedProbe({
      config: loadProbeConfig({ ...environment, COMMERCE_LOAD_REQUESTS: "2" }),
      fetchImpl: async () => Response.json({ status: "unexpected" }),
    }),
    /2 of 2 responses were invalid/,
  );
});

test("bounded probe enforces the p95 threshold", async () => {
  let clock = 0;
  await assert.rejects(
    runBoundedProbe({
      config: loadProbeConfig({ ...environment, COMMERCE_LOAD_REQUESTS: "2", COMMERCE_LOAD_CONCURRENCY: "1", COMMERCE_LOAD_MAXIMUM_P95_MS: "50" }),
      fetchImpl: async (url) => {
        clock += 60;
        return Response.json({ status: url.pathname === "/health" ? "ok" : "ready" });
      },
      now: () => clock,
    }),
    /p95 60 ms exceeded 50 ms/,
  );
});
