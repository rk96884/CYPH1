import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { runReadOnlyProbe } from "./src/hyperdrive-readonly-worker.mjs";

test("default flag makes no connections", async () => {
  let calls = 0;
  assert.deepEqual(await runReadOnlyProbe({}, () => { calls++; }), { status: "disabled" });
  assert.deepEqual(await runReadOnlyProbe({ HYPERDRIVE_PROBE_ENABLED: "false" }, () => { calls++; }), { status: "disabled" });
  assert.equal(calls, 0);
});

test("requires explicit binding and checks the database identity", async () => {
  await assert.rejects(runReadOnlyProbe({HYPERDRIVE_PROBE_ENABLED:"true"}), /binding missing/);
  let closed = 0, queries = [];
  const openPool = config => ({
    async query(sql) { queries.push(sql); return { rows: [{ database_name: "cyph1_commerce_development", job_count: 0 }] }; },
    async end() { closed++; },
  });
  const env = { HYPERDRIVE_PROBE_ENABLED: "true", HYPERDRIVE: { connectionString: "unused-in-test" } };
  assert.deepEqual(await runReadOnlyProbe(env, openPool), { status: "verified", jobCount: 0 });
  assert.equal(closed, 1);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /SELECT current_database\(\)/);
  assert.doesNotMatch(queries[0], /INSERT|UPDATE|DELETE|ALTER|CREATE|DROP/i);
});

test("wrong database fails closed and pool closes", async () => {
  let closed = false;
  await assert.rejects(runReadOnlyProbe(
    { HYPERDRIVE_PROBE_ENABLED: "true", HYPERDRIVE: { connectionString: "unused" } },
    () => ({ async query() { return { rows: [{ database_name:"cyph1_commerce_production", job_count:0 }] }; }, async end() { closed=true; } })
  ), /REFUSED/);
  assert.equal(closed, true);
});

test("public and scheduled handlers never run database probes", async () => {
  assert.equal((await worker.fetch()).status, 404);
  assert.equal(await worker.scheduled(), undefined);
  const config = await readFile(new URL("./wrangler.hyperdrive-readonly.toml", import.meta.url), "utf8");
  assert.match(config, /HYPERDRIVE_PROBE_ENABLED = "false"/);
  const active = config.split("\n").filter(line => !line.trim().startsWith("#")).join("\n");
  assert.doesNotMatch(active, /\[\[hyperdrive\]\]|\[triggers\]/);
});
