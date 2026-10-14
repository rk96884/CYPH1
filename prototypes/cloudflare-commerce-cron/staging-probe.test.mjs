import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runStagingProbe } from "./src/staging-probe-runner.mjs";

test("injected client is released after bounded claims", async () => {
  let released = 0, selected = 0;
  const client = {
    async query(sql) {
      if (sql.startsWith("SELECT")) return { rows: selected++ === 0 ? [{ id: 19 }] : [] };
      return { rows: [] };
    },
    async release() { released++; },
  };
  assert.deepEqual(await runStagingProbe(async () => client), { claimed: [19] });
  assert.equal(released, 1);
});

test("failure triggers rollback and connection release", async () => {
  let rolledBack = false, released = false;
  const client = {
    async query(sql) {
      if (sql === "ROLLBACK") rolledBack = true;
      if (sql.startsWith("SELECT")) throw new Error("synthetic failure");
      return { rows: [] };
    },
    async release() { released = true; },
  };
  await assert.rejects(runStagingProbe(async () => client), /synthetic failure/);
  assert.equal(rolledBack, true);
  assert.equal(released, true);
});

test("limits batch size and contains no live bindings", async () => {
  await assert.rejects(runStagingProbe(() => { throw new Error("should not connect"); }, 3), /Unsafe/);
  const sql = await readFile(new URL("./sql/staging-probe-setup.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS cyph1_hyperdrive_probe/);
  assert.match(sql, /GRANT SELECT, UPDATE \(status\)/);
  assert.doesNotMatch(sql, /GRANT ALL|SUPERUSER|CREATEDB|CREATE ROLE|CREATE USER|TRUNCATE|DROP TABLE/i);
  const runner = await readFile(new URL("./src/staging-probe-runner.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(runner, /process\.env|DATABASE_URL|BREVO_API_KEY|new pg\.|scheduled\(/);
});

test("development-only SQL setup and cleanup refuse production database", async () => {
  const setup = await readFile(new URL("./sql/staging-probe-setup.sql", import.meta.url), "utf8");
  const cleanup = await readFile(new URL("./sql/staging-probe-cleanup.sql", import.meta.url), "utf8");
  for (const sql of [setup, cleanup]) {
    assert.match(sql, /current_database\(\) <> 'cyph1_commerce_development'/);
    assert.match(sql, /RAISE EXCEPTION 'REFUSED:/);
    assert.doesNotMatch(sql, /DROP SCHEMA[^;]*CASCADE|0\.0\.0\.0\/0/);
  }
  assert.match(setup, /cyph1_hyperdrive_probe\.cyph1_hyperdrive_probe_jobs/);
  assert.match(setup, /NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole/);
  assert.match(cleanup, /DROP SCHEMA IF EXISTS cyph1_hyperdrive_probe RESTRICT/);
});
