import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { claimOne } from "./src/hyperdrive-transaction-harness.mjs";

const mock = (rows = [{ id: 7 }], failAt = "") => {
  const log = [];
  const client = { async query(sql, args) {
    log.push({ sql, args });
    if (sql.startsWith(failAt) && failAt) throw new Error("simulated-db-error");
    return sql.startsWith("SELECT") ? { rows } : { rows: [] };
  } };
  return { client, log };
};

test("claims using transactional row lock and bound query parameters", async () => {
  const { client, log } = mock();
  assert.equal(await claimOne(client), 7);
  assert.deepEqual(log.map(x => x.sql), [
    "BEGIN",
    "SELECT id FROM cyph1_hyperdrive_probe_jobs WHERE status = $1 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",
    "UPDATE cyph1_hyperdrive_probe_jobs SET status = $1 WHERE id = $2",
    "COMMIT",
  ]);
  assert.deepEqual(log[1].args, ["pending"]);
  assert.deepEqual(log[2].args, ["claimed", 7]);
});

test("no pending task commits without an update", async () => {
  const { client, log } = mock([]);
  assert.equal(await claimOne(client), null);
  assert.deepEqual(log.map(x => x.sql), ["BEGIN", log[1].sql, "COMMIT"]);
});

test("database failures roll back and do not claim", async () => {
  const { client, log } = mock([{ id: 2 }], "UPDATE");
  await assert.rejects(claimOne(client), /simulated-db-error/);
  assert.equal(log.at(-1).sql, "ROLLBACK");
  assert.equal(log.some(x => x.sql === "COMMIT"), false);
});

test("proof-of-concept files have no secrets, connections, or Cron bindings", async () => {
  const source = await readFile(new URL("./src/hyperdrive-transaction-harness.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new pg\.Pool|new pg\.Client|DATABASE_URL|BREVO_API_KEY|api\.brevo\.com|process\.env/);
});
