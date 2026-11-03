import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("../../docs/growth/research/ipl-creators-validation-round-2-2026-11-03.json",import.meta.url),"utf8"));
test("validation stays research-only with five unique creator profiles",()=>{
 assert.equal(data.creators.length,5);
 assert.equal(data.status,"partial_validation_pending_original_post_and_insights");
 assert.match(data.methodology.originalInstagramAccess,/unavailable/);
 const handles=data.creators.map(x=>x.handle);
 assert.equal(new Set(handles).size,5);
 for(const p of data.creators){
  assert.equal(p.reviewStatus.includes("original_not_accessed")||p.reviewStatus.includes("index_only")||p.reviewStatus.includes("not_test_proven"),true);
  assert.match(p.profileUrl,/^https:\/\/www\.instagram\.com\//);
  assert.ok(p.remaining.length>=2);
  assert.ok(!Object.hasOwn(p,"qualificationScore"));
  assert.ok(!Object.hasOwn(p,"approvedForOutreach"));
  assert.ok(!Object.hasOwn(p,"contactEmail"));
  assert.ok(!Object.hasOwn(p,"password"));
  assert.ok(!Object.hasOwn(p,"verifiedFirsthandReview"));
 }
});
test("audience and engagement metrics carry source and never imply platform interchangeability",()=>{
 for(const p of data.creators){
  if(p.audience.ukShareEstimatedPct!==null){
   assert.ok(p.audience.ukShareEstimatedPct>0&&p.audience.ukShareEstimatedPct<=100);
   assert.ok(p.audience.source?.startsWith("https://"));
   assert.ok(p.audience.asOf);
   assert.match(p.audience.notes,/Third-party/);
  }
  if(p.engagement.estimatedRatePct!==undefined&&p.engagement.estimatedRatePct!==null){
   assert.ok(p.engagement.source?.startsWith("https://"));
   assert.ok(p.engagement.asOf);
  }
  assert.ok(p.postSnapshot.source?.startsWith("https://"));
  assert.ok(p.postSnapshot.likes>=0&&p.postSnapshot.comments>=0);
 }
});
