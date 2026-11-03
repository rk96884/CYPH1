import test from "node:test";
import assert from "node:assert/strict";
import { qualifyProspect, rankProspects } from "./qualification.mjs";

const evidence = Object.fromEntries(
  ["relevance", "ukAudience", "engagement", "brandFit", "feasibility"].map(key =>
    [key, { rating: 5, sourceUrl: "https://example.org/evidence", note: "Public evidence checked" }]
  )
);
const creator = { name: "Example Creator", channel: "creator", sourceUrl: "https://example.org/profile", sourceCheckedAt: "2026-11-03", evidence };

test("fully evidenced creator gets 100 points, without outreach permission", () => {
  const result = qualifyProspect(creator);
  assert.equal(result.score, 100);
  assert.equal(result.confidence, 1);
  assert.equal(result.outreachAllowed, false);
  assert.equal(result.reviewRequired, true);
  assert.equal(result.status, "research_only");
});

test("missing sources earn no points or inferred confidence", () => {
  const result = qualifyProspect({ ...creator, evidence: { relevance: evidence.relevance, ukAudience: { rating: 5, note: "Missing source" } } });
  assert.equal(result.score, 30);
  assert.equal(result.confidence, 0.2);
  assert.equal(result.breakdown.ukAudience.verified, false);
});

test("out-of-range and fractional ratings are never accepted", () => {
  const result = qualifyProspect({ ...creator, evidence: { relevance: { ...evidence.relevance, rating: 6 }, ukAudience: { ...evidence.ukAudience, rating: 2.5 } } });
  assert.equal(result.score, 0);
});

test("unverified or invalid source URLs are rejected", () => {
  assert.throws(() => qualifyProspect({ ...creator, sourceUrl: "javascript:alert(1)" }), /sourceUrl/);
  assert.throws(() => qualifyProspect({ ...creator, channel: "consumer" }), /channel/);
});

test("ranking is deterministic", () => {
  const ranked = rankProspects([{ ...creator, name: "B", evidence: {} }, { ...creator, name: "A" }]);
  assert.deepEqual(ranked.map(x => x.name), ["A", "B"]);
});

test("partner scoring uses partner weights", () => {
  const result = qualifyProspect({ ...creator, channel: "partner" });
  assert.equal(result.score, 100);
  assert.equal(result.breakdown.brandFit.maximum, 20);
});
