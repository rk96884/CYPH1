import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyIplImportAction,verifyIplImportConnection,importReviewedIplResearch
} from "./import-reviewed-ipl-development.mjs";
import {loadReviewedIplEvidence} from "./ipl-evidence.mjs";

const reviewed=await loadReviewedIplEvidence();
const identities=new Map([
  ["beautygeeksascha","id-sascha"],["backtoyoubeauty","id-sharon"],
  ["nlondors","id-nicola"],["skinandbase","id-janet"],["lifeofhanna_","id-hanna"]
]);
test("plan requires no credentials; apply needs deliberate confirmation and TLS",()=>{
  assert.doesNotThrow(()=>verifyIplImportAction({ACTION:"plan"}));
  assert.throws(()=>verifyIplImportAction({ACTION:"apply"}),/confirmation/);
  assert.throws(()=>verifyIplImportAction({ACTION:"apply",CONFIRMATION:"IMPORT-IPL-EVIDENCE-RESEARCH-ONLY",DATABASE_SSL:"false"}),/confirmation/);
  assert.doesNotThrow(()=>verifyIplImportAction({ACTION:"apply",CONFIRMATION:"IMPORT-IPL-EVIDENCE-RESEARCH-ONLY",DATABASE_SSL:"true"}));
});
test("import account cannot write commerce or let reader mutate IPL research",async()=>{
  const p={db:"cyph1_commerce_development",actor:"growth_import_dev",
    ipl_select:true,ipl_insert:true,ipl_mutate:false,audit_insert:true,
    reader_select:true,reader_write:false,commerce:false};
  await verifyIplImportConnection(async()=>({rows:[p]}));
  await assert.rejects(verifyIplImportConnection(async()=>({rows:[{...p,actor:"commerce_owner"}]})),/invalid/);
  await assert.rejects(verifyIplImportConnection(async()=>({rows:[{...p,reader_write:true}]})),/invalid/);
  await assert.rejects(verifyIplImportConnection(async()=>({rows:[{...p,commerce:true}]})),/invalid/);
});
test("transaction inserts five IPL records with audit only and preserves scores",async()=>{
  const calls=[];
  const client={query:async(sql,params=[])=>{
    calls.push({sql,params});
    if(sql.startsWith("SELECT id, review_status")) {
      const match=Array.from(identities.entries()).find(([handle])=>params[0].includes("/"+handle+"/"));
      return {rows:[{id:match[1],review_status:"research_only"}]};
    }
    if(sql.includes("RETURNING id"))return {rows:[{id:"new-row"}]};
    return {rows:[]};
  }};
  const result=await importReviewedIplResearch(client,reviewed);
  assert.deepEqual(result,{inserted:5,unchanged:0,researchOnly:true,outreachEnabled:false,scoresChanged:false});
  assert.equal(calls[0].sql,"BEGIN");
  assert.equal(calls.at(-1).sql,"COMMIT");
  assert.equal(calls.filter(x=>x.sql.includes("INSERT INTO growth.ipl_experience")).length,5);
  assert.equal(calls.filter(x=>x.sql.includes("INSERT INTO growth.audit_log")).length,5);
  assert.ok(!calls.some(x=>/UPDATE\s+growth\.prospects|DELETE\s+FROM|outreach_drafts/i.test(x.sql)));
});
test("unknown or non-research-only source rolls back the entire batch",async()=>{
  const calls=[];
  const client={query:async sql=>{
    calls.push(sql);
    if(sql.startsWith("SELECT id, review_status")) return {rows:[]};
    return {rows:[]};
  }};
  await assert.rejects(importReviewedIplResearch(client,reviewed),/rolled back/);
  assert.equal(calls.at(-1),"ROLLBACK");
  assert.ok(!calls.includes("COMMIT"));
});
