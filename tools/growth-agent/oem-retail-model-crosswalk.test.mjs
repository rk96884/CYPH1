import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
const research=JSON.parse(await readFile(new URL("../../docs/growth/research/oem-retail-model-crosswalk-2026-11-04.json",import.meta.url),"utf8"));
test("retail OEM model research is documentary and research-only",()=>{
 assert.equal(research.status,"research_only_not_imported");
 assert.equal(research.manufacturerTrace.length,4);
 assert.deepEqual(research.relatedOriginalQuotation.models,["SL-B352-2","SL-B329"]);
 assert.ok(research.constraints.some(s=>s.includes("No score changes")));
 assert.equal(research.manufacturerTrace.some(x=>x.quotedModel==="K-803"&&x.retailBrand===null),true);
 assert.ok(research.manufacturerTrace.every(x=>x.evidence.length&&x.evidence.every(y=>y.url.startsWith("https://"))));
 assert.ok(research.manufacturerTrace.every(x=>x.verificationIssues.length>0));
 assert.ok(research.manufacturerTrace.every(x=>!Object.hasOwn(x,"approvedForOutreach")&&!Object.hasOwn(x,"qualificationScore")));
});
test("confidence separation: exact Semlamp retail records versus unverified IONKA K902",()=>{
 const get=model=>research.manufacturerTrace.find(x=>x.quotedModel===model);
 assert.match(get("SL-B329").confidence,/confirmed_documentary/);
 assert.match(get("SL-B352-2").confidence,/strong_explicit_exact_model/);
 assert.match(get("K-902").confidence,/unverified_oem/);
 assert.match(get("K-803").confidence,/no_confirmed_retail_alias/);
 assert.equal(get("K-902").retailBrand,"SkinRevolve");
 assert.equal(get("SL-B329").retailBrand,"Emmié by HappySkin");
 assert.equal(get("SL-B352-2").retailBrand,"KXP / Yete");
});
