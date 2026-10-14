import test from "node:test";
import assert from "node:assert/strict";
import worker, { scheduled } from "./src/worker.mjs";

test("disabled cron tick has no external dependencies or side effects", async () => {
  let reads = [];
  const env = new Proxy({ COMMERCE_CRON_ENABLED: "false" }, { get(target, key) { reads.push(String(key)); return target[key]; } });
  assert.deepEqual(await scheduled({}, env), { status: "disabled" });
  assert.deepEqual(reads, ["COMMERCE_CRON_ENABLED"]);
  assert.deepEqual(await scheduled({}, undefined), { status: "disabled" });
});

test("accidental cron enablement fails closed instead of sending or connecting", async () => {
  await assert.rejects(scheduled({}, { COMMERCE_CRON_ENABLED: "true" }), /not been implemented or approved/);
});

test("public HTTP requests cannot trigger cron processing", async () => {
  const response = await worker.fetch(new Request("https://example.invalid/"));
  assert.equal(response.status, 404);
});

test("configuration defines a five-minute cron but no live integrations", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = await readFile(new URL("./wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /crons\s*=\s*\["\*\/5 \* \* \* \*"\]/);
  assert.match(config, /COMMERCE_CRON_ENABLED\s*=\s*"false"/);
  assert.doesNotMatch(config, /^\s*\[\[(?:hyperdrive|d1_databases|queues\.consumers)\]\]/m);
});
