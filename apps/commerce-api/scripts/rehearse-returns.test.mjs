import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("returns rehearsal rejects connection overrides before imports or connection", () => {
  for (const suffix of ["?host=remote.example", "?hostaddr=192.0.2.1", "?port=5433", "?service=remote", "?", "?sslmode=require"]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./rehearse-returns.mjs", import.meta.url))], {
      env: { ...process.env, NODE_ENV: "test", RETURNS_TEST_DATABASE_URL: `postgresql://127.0.0.1:1/synthetic_returns_test${suffix}` },
      encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /without query parameters/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|ENOTFOUND|ERR_MODULE_NOT_FOUND/);
  }
});
