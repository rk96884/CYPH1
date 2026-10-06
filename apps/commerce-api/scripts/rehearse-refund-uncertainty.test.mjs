import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("refund uncertainty rehearsal rejects non-disposable and overridden connections before imports", () => {
  for (const [NODE_ENV, REFUND_TEST_DATABASE_URL] of [
    ["production", "postgresql://127.0.0.1:1/synthetic_refunds_test"],
    ["test", "postgresql://remote.example/synthetic_refunds_test"],
    ["test", "postgresql://127.0.0.1:1/production"],
    ["test", "postgresql://127.0.0.1:1/synthetic_refunds_test?host=remote.example"],
    ["test", "postgresql://127.0.0.1:1/synthetic_refunds_test?"],
  ]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./rehearse-refund-uncertainty.mjs", import.meta.url))], {
      env: { ...process.env, NODE_ENV, REFUND_TEST_DATABASE_URL }, encoding: "utf8", timeout: 10000, windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /disposable local/);
    assert.doesNotMatch(result.stderr, /ECONNREFUSED|ENOTFOUND|ERR_MODULE_NOT_FOUND/);
  }
});
