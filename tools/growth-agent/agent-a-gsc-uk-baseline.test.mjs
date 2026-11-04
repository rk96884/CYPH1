import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
const report=JSON.parse(await readFile(new URL("../../docs/growth/agent-a/gsc-uk-baseline-2026-11-04.json",import.meta.url),"utf8"));
test("GSC report is source-backed and research only",()=>{
  assert.equal(report.status,"read_only_research_not_published");
  assert.equal(report.connector,"Windsor.ai / Google Search Console");
  assert.equal(report.account,"sc-domain:cyph1.co.uk");
  assert.equal(report.requestedPeriod.inclusiveDays,90);
  assert.equal(report.ukSummary.country,"United Kingdom");
  assert.equal(report.ukSummary.impressions,56);
  assert.equal(report.ukSummary.clicks,0);
  assert.equal(report.ukAttributable.queryPageImpressions,44);
  assert.equal(report.ukAttributable.unattributedImpressions,12);
});
test("UK query rows reconcile only with attributable subset",()=>{
  const sum=report.ukQueries.reduce((n,x)=>n+x.impressions,0);
  assert.equal(sum,report.ukAttributable.queryPageImpressions);
  assert.equal(report.ukPages.reduce((n,x)=>n+x.impressions,0),44);
  assert.equal(report.ukQueries.every(x=>x.country==="United Kingdom"),true);
  assert.equal(report.ukQueries.every(x=>x.page.includes("/learn/hair-growth-cycle/")),true);
  assert.equal(report.ukQueries.some(x=>x.query==="hair growth cycle"&&x.impressions===27),true);
});
test("global page totals remain separate; sitemap submission not equated to indexed",()=>{
  assert.equal(report.allCountryLandingPages.reduce((n,x)=>n+x.impressions,0),156);
  assert.equal(report.allCountryLandingPages.reduce((n,x)=>n+x.clicks,0),2);
  assert.equal(report.sitemap[0].submitted,7);
  assert.equal(report.sitemap[0].errors,0);
  assert.ok(report.notes.some(x=>x.includes("not indexed count")));
  assert.ok(report.notes.some(x=>x.includes("not Google keyword search volumes")));
  assert.equal(report.ukQueries.some(x=>Object.hasOwn(x,"monthlySearchVolume")),false);
});
