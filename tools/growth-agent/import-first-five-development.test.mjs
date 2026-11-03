import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { verifyPilotBatch, verifyAction, PILOT_SOURCES } from "./import-first-five-development.mjs";

const batch = JSON.parse(await readFile(new URL("../../docs/growth/research/first-five-uk-creators.json", import.meta.url), "utf8"));

test("first-five batch is real-source research-only, not approved outreach", () => {
  const rows=verifyPilotBatch(batch);
  assert.equal(rows.length,5);
  assert.equal(new Set(rows.map(p=>p.sourceKey)).size,5);
  assert.deepEqual(rows.map(p=>p.sourceUrl),[...PILOT_SOURCES]);
  assert.ok(rows.every(p=>p.channel==="creator" && p.confidence>0 && p.confidence<=0.4));
});
test("pilot cannot include unexpected candidates or contact data", () => {
  const extra=structuredClone(batch);
  extra.prospects[0].email="test@example.com";
  assert.throws(()=>verifyPilotBatch(extra),/Unexpected candidate data/);
  const replacement=structuredClone(batch);
  replacement.prospects[0].sourceUrl="https://example.com/unknown";
  assert.throws(()=>verifyPilotBatch(replacement),/Unexpected pilot candidate/);
  const wrong=structuredClone(batch);
  wrong.prospects[1].channel="partner";
  assert.throws(()=>verifyPilotBatch(wrong),/Creators only/);
});
test("no unverified audience or engagement claims permitted", () => {
  for(const dimension of ["ukAudience","engagement"]){
    const changed=structuredClone(batch);
    changed.prospects[0].evidence[dimension]={rating:5,note:"unverified",sourceUrl:changed.prospects[0].sourceUrl};
    assert.throws(()=>verifyPilotBatch(changed),/not yet verified/);
  }
});
test("apply requires deliberate exact confirmation; plan is read-only",()=>{
  assert.doesNotThrow(()=>verifyAction({action:"plan"}));
  assert.throws(()=>verifyAction({action:"apply"}),/confirmation/);
  assert.throws(()=>verifyAction({action:"apply",confirmation:"INCORRECT"}),/confirmation/);
  assert.doesNotThrow(()=>verifyAction({action:"apply",confirmation:"IMPORT-FIVE-RESEARCH-ONLY-DEV"}));
});
