import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateIplEvidenceBatch,loadReviewedIplEvidence } from "./ipl-evidence.mjs";

const fixture=JSON.parse(await readFile(new URL("../../docs/growth/research/ipl-experience-first-five.json",import.meta.url),"utf8"));
const changed=(fn)=>{const copy=structuredClone(fixture);fn(copy);return copy;};

test("five reviewed creators have evidence classifications without scoring or outreach",async()=>{
  const rows=await loadReviewedIplEvidence();
  assert.equal(rows.length,5);
  assert.equal(rows.filter(r=>r.classification==="ipl_review_confirmed").length,1);
  assert.equal(rows.filter(r=>r.classification==="ipl_coverage_confirmed").length,1);
  assert.equal(rows.filter(r=>r.classification==="needs_verification").length,3);
  assert.ok(rows.every(r=>!Object.hasOwn(r,"score") && !Object.hasOwn(r,"outreachAllowed")));
  assert.equal(rows[0].device,"Ulike Air 10");
  assert.equal(rows[1].device,"Sensica Sensilight Mini");
});
test("identity and batch fields are allowlisted",()=>{
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects.reverse()),/Unexpected creator/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].email="private@example.org")),/Unexpected IPL evidence field/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].score=100)),/Unexpected IPL evidence field/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].outreachAllowed=true)),/Unexpected IPL evidence field/);
});
test("positive IPL claims require dated primary evidence",()=>{
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].sourceUrl="http://localhost/report")),/Positive IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].sourceUrl="https://malicious.example/")),/Positive IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].sourceUrl="https://beautygeekuk.com.evil.example/2025/ipl")),/Positive IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].publishedAt="2030-01-01")),/Positive IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].device=null)),/Positive IPL claim/);
});
test("no ambiguous claims of IPL experience or conflation with laser",()=>{
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[2].classification="ipl_review_confirmed")),/Positive IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[2].device="Unknown IPL")),/Unverified IPL claim/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].technology="laser")),/Confirmed IPL test/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[1].technology="laser")),/IPL coverage/);
  assert.throws(()=>validateIplEvidenceBatch(changed(b=>b.prospects[0].firsthandTestConfirmed=false)),/Confirmed IPL test/);
});
