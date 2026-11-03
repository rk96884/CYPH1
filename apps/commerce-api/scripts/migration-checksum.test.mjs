import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { migrationChecksumMatches, legacyLineEndingVersions, sha256 } from "./migration-checksum.mjs";

const devChecksums = new Map(Object.entries({
  "0011_operator_capture.sql": "e84536d8b69109239cf311ac73881fd320460b377aab01c2452aa781afff8f2d",
  "0012_capture_deadline_monitor.sql": "b2c6074d17073c19bbb82513004e554d2862d3109ab62e1e90acb6f27538110d",
  "0013_capture_command_reconciliation.sql": "d493f86bb17b2e0a9f403d36b020dbb15c851445893fe10f4c1c7093d6dafa4a",
  "0014_pending_capture_command.sql": "8e410784340554f2179f664394f97d51872ff8e8c5a985350e2803d5eb99ee04",
  "0015_merchandise_returns.sql": "39f5d6a3632a42c36129799383c49a7020ee73b1c39e4229752a827bc2d90e30",
  "0016_manual_dispatch.sql": "9cac346338c6a9f36d8b1e7f2cc26e3a382f7427d6edae6fdb234891a8a06ea5",
  "0017_communication_send_safety.sql": "11124a41467ec3a35cfbaa2f6b46af8d8845b46312ba3ff32bb2a77a6b0bd32a",
  "0018_shipping_pricing_evidence.sql": "30fb7b97bab7c2bdca67d3ffe56be9bd7de20595f530282bad3088dca2bea3a9",
  "0019_carrier_tariffs_and_packaging.sql": "30ab00ba060c0592b86574b50ea62a2291eb5b96460b4f1899c7cb5f7803ae1a"
}));

test("all nine observed development hashes match only CRLF encoding of current migration SQL", async () => {
  assert.equal(legacyLineEndingVersions.length, 9);
  for (const file of legacyLineEndingVersions) {
    const content = await readFile(new URL("../db/migrations/" + file, import.meta.url), "utf8");
    const observed = devChecksums.get(file);
    assert.equal(sha256(content.replace(/\n/g, "\r\n")), observed, file);
    assert.equal(migrationChecksumMatches({ file, content, recorded: observed, databaseName: "cyph1_commerce_development" }), true, file);
    assert.equal(migrationChecksumMatches({ file, content, recorded: observed, databaseName: "cyph1_commerce_production" }), false, file);
    assert.equal(migrationChecksumMatches({ file, content: content + "-- changed\n", recorded: observed, databaseName: "cyph1_commerce_development" }), false, file);
    assert.equal(migrationChecksumMatches({ file, content, recorded: sha256(content), databaseName: "cyph1_commerce_production" }), true, file);
  }
});

test("no other version or database can use a CRLF exception", () => {
  const content = "SELECT 1;\n";
  const crlf = sha256("SELECT 1;\r\n");
  for (const file of ["0020_inpost_collection_review.sql", "9000_growth_agent_foundation.sql", "0010_worker_claim_leases.sql"]) {
    assert.equal(migrationChecksumMatches({ file, content, recorded: crlf, databaseName: "cyph1_commerce_development" }), false);
  }
  assert.equal(migrationChecksumMatches({ file: "0011_operator_capture.sql", content, recorded: crlf, databaseName: "cyph1_commerce_development_copy" }), false);
  assert.equal(migrationChecksumMatches({ file: "0011_operator_capture.sql", content, recorded: "not a hash", databaseName: "cyph1_commerce_development" }), false);
});
