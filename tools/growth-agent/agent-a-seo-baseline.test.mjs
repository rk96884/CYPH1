import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("../../docs/growth/agent-a/agent-a-baseline-2026-11-04.json", import.meta.url), "utf8"));

test("Agent A demand baseline is research only and never invents UK Google volumes",()=>{
 assert.equal(data.status,"research_only_not_published");
 assert.equal(data.siteEvidence.codeOnly,true);
 assert.equal(data.siteEvidence.technical.noLiveIndexingProof,true);
 assert.ok(data.constraints.some(x=>x.includes("No fabricated Google")));
 assert.ok(data.marketSignals.some(x=>x.kind.includes("Amazon UK marketplace")));
 assert.ok(data.marketSignals.some(x=>x.kind.includes("worldwide")));
 for(const op of data.contentOpportunities){
  assert.ok(op.intent && op.currentCoverage && op.risk && op.priority);
  assert.ok(!Object.hasOwn(op,"monthlyGoogleSearchVolume"));
  assert.ok(!Object.hasOwn(op,"keywordDifficulty"));
  assert.ok(!Object.hasOwn(op,"rank"));
  assert.ok(!Object.hasOwn(op,"approvedForPublishing"));
 }
});
test("product copy, clinical claims and treatment schedule retain manual review gates",()=>{
 assert.equal(data.siteEvidence.productPriceCode.intendedPriceGBP,74.99);
 assert.match(data.siteEvidence.productPriceCode.approvalStatus,/revalidation/);
 const freq=data.contentOpportunities.find(x=>x.id==="A-03");
 assert.match(freq.risk,/Don't publish CYPH\/1 instructions/);
 const safety=data.contentOpportunities.find(x=>x.id==="A-08");
 assert.match(safety.risk,/Do not publish/);
 assert.ok(data.measurementsNeeded.some(x=>x.includes("Google Search Console")));
});
