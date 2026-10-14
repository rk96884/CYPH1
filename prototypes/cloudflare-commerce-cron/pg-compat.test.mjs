import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { driverVersionContract } from "./src/pg-compat-probe.mjs";

test("node-postgres driver can be resolved without connecting", () => {
  assert.deepEqual(driverVersionContract(), { pool: true, client: true });
});

test("build-only probe has no database, webhook, cron, or remote bindings", async () => {
  const config = await readFile(new URL("./wrangler.pg-compat.toml", import.meta.url), "utf8");
  assert.match(config, /compatibility_flags\s*=\s*\["nodejs_compat"\]/);
  assert.match(config, /COMMERCE_CRON_ENABLED\s*=\s*"false"/);
  assert.doesNotMatch(config, /\[triggers\]|\[\[hyperdrive\]\]|\[\[d1_databases\]\]|\[\[queues/);
});

test("even the imported driver probe cannot activate processing", async () => {
  const { default: worker } = await import("./src/pg-compat-probe.mjs");
  assert.deepEqual(await worker.scheduled({}, { COMMERCE_CRON_ENABLED: "false" }), { status: "disabled" });
  await assert.rejects(worker.scheduled({}, { COMMERCE_CRON_ENABLED: "true" }), /not been implemented or approved/);
  assert.equal((await worker.fetch()).status, 404);
});
