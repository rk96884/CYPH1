import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { manualTestScheduled } from "./src/hyperdrive-manual-test-worker.mjs";

test("disabled manual test cannot call probe", async () => {
  let called = 0;
  const probe = async () => { called++; };
  assert.deepEqual(await manualTestScheduled({ cron: "__manual_hyperdrive_test__" }, {}, {}, probe), { status:"disabled" });
  assert.equal(called, 0);
});

test("enabled manual test only accepts explicit one-time marker", async () => {
  let called = 0;
  const probe = async () => { called++; return { status: "verified", jobCount: 0 }; };
  const env = { HYPERDRIVE_PROBE_ENABLED: "true" };
  assert.deepEqual(await manualTestScheduled({cron:"*/5 * * * *"}, env, {}, probe), {status:"not_manual_test"});
  assert.equal(called, 0);
  assert.deepEqual(await manualTestScheduled({cron:"__manual_hyperdrive_test__"}, env, {}, probe), {status:"verified",jobCount:0});
  assert.equal(called, 1);
});

test("no public route, active Cron or secret config", async () => {
  assert.equal((await worker.fetch()).status, 404);
  const config = await readFile(new URL("./wrangler.hyperdrive-manual-test.toml", import.meta.url), "utf8");
  const active = config.split("\n").filter(l => !l.trimStart().startsWith("#")).join("\n");
  assert.match(active, /HYPERDRIVE_PROBE_ENABLED = "false"/);
  assert.doesNotMatch(active, /\[triggers\]|DATABASE_URL|BREVO_API_KEY|localConnectionString/);
  assert.match(active, /\[\[hyperdrive\]\]/);
  assert.match(active, /binding = "HYPERDRIVE"/);
  assert.match(active, /id = "05becdcb7b9041b297568df15553518f"/);
});
