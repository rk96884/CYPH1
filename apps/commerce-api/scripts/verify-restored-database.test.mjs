import assert from "node:assert/strict";
import test from "node:test";
import { compareRestoreSnapshots, loadRestoreVerificationConfig } from "./verify-restored-database.mjs";

const guardedEnvironment = {
  ALLOW_DATABASE_RESTORE_VERIFICATION: "true",
  DATABASE_RESTORE_VERIFICATION_CONFIRM: "restore-rehearsal",
  SOURCE_DATABASE_URL: "postgresql://source:secret@source.example/commerce_staging",
  RESTORE_DATABASE_URL: "postgresql://restore:secret@localhost/commerce_restore_test",
  SOURCE_DATABASE_SSL: "true",
  RESTORE_DATABASE_SSL: "false",
};

test("restore verification requires explicit guards and a distinct test target", () => {
  assert.throws(() => loadRestoreVerificationConfig({}), /explicit rehearsal guards/);
  const config = loadRestoreVerificationConfig(guardedEnvironment);
  assert.equal(config.source.database, "commerce_staging");
  assert.equal(config.restore.database, "commerce_restore_test");
  assert.equal(config.sourceSsl, true);
  assert.equal(config.restoreSsl, false);
  assert.throws(() => loadRestoreVerificationConfig({
    ...guardedEnvironment,
    RESTORE_DATABASE_URL: guardedEnvironment.SOURCE_DATABASE_URL,
  }), /different from the source/);
  assert.throws(() => loadRestoreVerificationConfig({
    ...guardedEnvironment,
    RESTORE_DATABASE_URL: "postgresql://restore:secret@localhost/commerce",
  }), /must contain restore, recovery or test/);
});

test("restore verification rejects malformed URLs and loose boolean values", () => {
  assert.throws(() => loadRestoreVerificationConfig({ ...guardedEnvironment, SOURCE_DATABASE_URL: "not-a-url" }), /valid PostgreSQL URL/);
  assert.throws(() => loadRestoreVerificationConfig({ ...guardedEnvironment, RESTORE_DATABASE_SSL: "TRUE" }), /either true or false/);
});

test("matching aggregate snapshots pass without personal-data comparison", () => {
  const counts = new Proxy({}, { get: () => "3" });
  const snapshot = { migrations: [{ version: "0001", checksum: "abc" }], counts };
  assert.deepEqual(compareRestoreSnapshots(snapshot, snapshot), { migrationCount: 1, tableCount: 23 });
});

test("migration or row-count differences fail", () => {
  const allThree = new Proxy({}, { get: () => "3" });
  const oneDifferent = new Proxy({}, { get: (_target, name) => name === "orders" ? "2" : "3" });
  assert.throws(() => compareRestoreSnapshots(
    { migrations: [{ version: "0001", checksum: "abc" }], counts: allThree },
    { migrations: [{ version: "0001", checksum: "changed" }], counts: allThree },
  ), /migration history/);
  assert.throws(() => compareRestoreSnapshots(
    { migrations: [{ version: "0001", checksum: "abc" }], counts: allThree },
    { migrations: [{ version: "0001", checksum: "abc" }], counts: oneDifferent },
  ), /orders/);
});
