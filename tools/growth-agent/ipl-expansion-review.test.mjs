import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const file=new URL("../../docs/growth/research/ipl-expansion-candidate-review-2026-11-03.json",import.meta.url);
const data=JSON.parse(await readFile(file,"utf8"));

test("expanded IPL shortlist remains unimported and research only",()=>{
  assert.equal(data.status,"review_queue_not_imported");
  assert.match(data.policy,/No automatic outreach/);
  assert.equal(data.reviewDate,"2026-11-03");
  assert.equal(data.socialCreators.length,5);
  assert.equal(data.editorialReviewers.length,4);
  assert.ok(!Object.hasOwn(data,"scores"));
  assert.ok(!Object.hasOwn(data,"outreachEnabled"));
});
test("social candidates are uniquely identifiable and sponsored context is explicit",()=>{
  const handles=new Set();
  for(const row of data.socialCreators){
    assert.match(row.handle,/^[a-zA-Z0-9._]+$/);
    assert.ok(!handles.has(row.handle));
    handles.add(row.handle);
    assert.equal(row.platform,"Instagram");
    assert.match(row.commercialContext,/sponsored/i);
    assert.match(row.sourceUrl,/^https:\/\/www\.modash\.io\/content-library\/brands\/ulike-examples$/);
    assert.ok(row.evidence.length>45);
    assert.ok(row.needsVerification.some(x=>/UK|audience|followers/i.test(x)));
    assert.ok(!Object.hasOwn(row,"score"));
    assert.ok(!Object.hasOwn(row,"email"));
    assert.ok(!Object.hasOwn(row,"verifiedUKAudience"));
  }
});
test("independent/editorial authors stay separate from paid social creator queue",()=>{
  for(const row of data.editorialReviewers){
    assert.match(row.classification,/firsthand/);
    assert.equal(row.sources.length>=1,true);
    assert.ok(row.sources.every(url=>url.startsWith("https://")));
    assert.ok(row.evidence.length>50);
  }
});
