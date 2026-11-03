import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSource, prepareResearchBatch, ingestResearch } from "./ingest.mjs";

const prospect = {
  name: "Example Research", channel: "creator",
  sourceUrl: "https://example.org/creator#profile", sourceCheckedAt: "2026-11-03",
  evidence: { relevance: { rating: 4, sourceUrl: "https://example.org/review", note: "Public topical evidence" } }
};
const batch = { prospects: [prospect] };

test("research batch is scored, canonicalised and never outreach-ready", () => {
  const [item] = prepareResearchBatch(batch);
  assert.equal(item.score, 24);
  assert.equal(item.confidence, 0.2);
  assert.equal(item.sourceUrl, "https://example.org/creator");
  assert.match(item.sourceKey, /^[a-f0-9]{64}$/);
  assert.equal(item.evidence.length, 1);
  assert.equal(Object.hasOwn(item, "email"), false);
});

test("bad URLs, duplicate identities and missing evidence are rejected", () => {
  for (const url of ["http://example.org", "https://localhost/private", "https://127.0.0.1", "https://10.0.0.1/", "https://example.local/", "javascript:alert(1)"]) {
    assert.throws(() => canonicalSource(url), /public HTTPS|Invalid/);
  }
  assert.throws(() => prepareResearchBatch({ prospects: [{ ...prospect, evidence: {} }] }), /At least one/);
  assert.throws(() => prepareResearchBatch({ prospects: [prospect, prospect] }), /Duplicate/);
  assert.throws(() => prepareResearchBatch({ prospects: Array.from({ length: 26 }, () => prospect) }), /1 to 25/);
});

test("import is transactional and duplicates do not overwrite existing decisions", async () => {
  const statements = [];
  let insert = 0;
  const client = { query: async (sql, args) => {
    statements.push([sql, args]);
    if (sql.includes("INSERT INTO growth.research_runs")) return { rows: [{ id: "run-1" }] };
    if (sql.includes("INSERT INTO growth.prospects")) return { rows: ++insert === 1 ? [{ id: "prospect-1" }] : [] };
    return { rows: [] };
  }};
  const result = await ingestResearch(client, [prepareResearchBatch(batch)[0], prepareResearchBatch({
    prospects: [{ ...prospect, channel: "partner" }]
  })[0]]);
  assert.equal(result.inserted, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.outreachEnabled, false);
  assert.equal(statements[0][0], "BEGIN");
  assert.equal(statements.at(-1)[0], "COMMIT");
  assert.equal(statements.filter(([sql]) => sql.includes("INSERT INTO growth.prospect_evidence")).length, 1);
  assert.ok(statements.some(([sql]) => sql.includes("ON CONFLICT (channel,source_key) DO NOTHING")));
  assert.ok(statements.some(([sql]) => sql.includes("growth.audit_log")));
  assert.ok(statements.every(([sql]) => !/public\.orders|public\.payments|outreach_drafts/i.test(sql)));
});

test("failed write rolls back the entire batch", async () => {
  const statements = [];
  const client = { query: async sql => {
    statements.push(sql);
    if (sql.includes("INSERT INTO growth.research_runs")) return { rows: [{ id: "run-1" }] };
    if (sql.includes("INSERT INTO growth.prospects")) throw new Error("synthetic failure");
    return { rows: [] };
  }};
  await assert.rejects(ingestResearch(client, prepareResearchBatch(batch)), /synthetic failure/);
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.ok(!statements.includes("COMMIT"));
});
