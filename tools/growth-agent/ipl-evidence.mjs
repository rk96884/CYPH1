import { readFile } from "node:fs/promises";

export const IPL_CLASSES=Object.freeze([
  "ipl_review_confirmed","ipl_coverage_confirmed","other_hair_removal_tech",
  "beauty_device_only","no_public_ipl_evidence_found","needs_verification"
]);
export const PILOT_HANDLES=Object.freeze([
  "beautygeeksascha","backtoyoubeauty","nlondors","skinandbase","lifeofhanna_"
]);
const MAX_NOTE=750;
const FIELDS=new Set([
  "handle","classification","device","technology","sourceUrl","publishedAt",
  "checkedAt","firsthandTestConfirmed","format","note"
]);
const POSITIVE=new Set(["ipl_review_confirmed","ipl_coverage_confirmed","other_hair_removal_tech","beauty_device_only"]);
const VALID_TECH=new Set(["IPL","light_based_ipl","laser","other_beauty_device"]);
const VALID_FORMAT=new Set(["first_person_initial_impressions","hands_on_review","article_recommendation","product_feature","comparison"]);
const isoDay=value=>typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const safeSource=value=>{
  if(typeof value!=="string" || value.length>2048) return false;
  try {
    const url=new URL(value);
    return url.protocol==="https:" && !url.username && !url.password && !url.port && !url.hash &&
      ["beautygeekuk.com","www.beautygeekuk.com","www.backtoyoubeauty.co.uk","backtoyoubeauty.co.uk"].includes(url.hostname) &&
      url.pathname.length>10;
  } catch{return false;}
};

export function validateIplEvidenceBatch(input){
  if(!input || Array.isArray(input) || typeof input!=="object" ||
     input.policyVersion!==1 || !isoDay(input.reviewDate) ||
     !Array.isArray(input.prospects) || input.prospects.length!==5 ||
     typeof input.purpose!=="string" || !input.purpose.includes("research only")) {
    throw Error("Invalid five-creator research-only IPL batch");
  }
  if(Object.keys(input).some(k=>!["policyVersion","reviewDate","purpose","prospects"].includes(k))) {
    throw Error("Unknown batch field");
  }
  const handles=input.prospects.map(row=>row?.handle);
  if(JSON.stringify(handles)!==JSON.stringify(PILOT_HANDLES)) throw Error("Unexpected creator identity or order");
  for(const row of input.prospects){
    if(!row || typeof row!=="object" || Array.isArray(row) ||
       Object.keys(row).some(k=>!FIELDS.has(k))) throw Error("Unexpected IPL evidence field");
    if(!IPL_CLASSES.includes(row.classification) || !isoDay(row.checkedAt) ||
       row.checkedAt>input.reviewDate || typeof row.firsthandTestConfirmed!=="boolean" ||
       typeof row.note!=="string" || row.note.trim().length<30 ||
       row.note.length>MAX_NOTE) throw Error("Invalid IPL research evidence");
    const hasSource=POSITIVE.has(row.classification);
    if(hasSource){
      if(!safeSource(row.sourceUrl) || !isoDay(row.publishedAt) ||
         row.publishedAt>row.checkedAt || !row.device || row.device.length>100 ||
         !VALID_TECH.has(row.technology) || !VALID_FORMAT.has(row.format)){
        throw Error("Positive IPL claim requires dated primary evidence and device");
      }
    } else if(row.sourceUrl!==null || row.publishedAt!==null || row.device!==null ||
              row.technology!==null || row.format!==null || row.firsthandTestConfirmed){
      throw Error("Unverified IPL claim must have no device or source attribution");
    }
    if(row.classification==="ipl_review_confirmed" &&
       (!row.firsthandTestConfirmed || !["IPL","light_based_ipl"].includes(row.technology))){
      throw Error("Confirmed IPL test requires an attributable firsthand IPL report");
    }
    if(row.classification==="ipl_coverage_confirmed" &&
       !["IPL","light_based_ipl"].includes(row.technology)){
      throw Error("IPL coverage must be distinct from laser technology");
    }
    if(row.classification==="other_hair_removal_tech" && row.technology!=="laser"){
      throw Error("Other hair-removal technology must be marked separately");
    }
    if(row.classification==="beauty_device_only" && row.technology!=="other_beauty_device"){
      throw Error("Generic beauty technology is not IPL or laser evidence");
    }
  }
  return Object.freeze(input.prospects.map(row=>Object.freeze({...row})));
}

export async function loadReviewedIplEvidence(){
  const url=new URL("../../docs/growth/research/ipl-experience-first-five.json",import.meta.url);
  const text=await readFile(url,"utf8");
  if(Buffer.byteLength(text)>20*1024) throw Error("IPL research evidence too large");
  return validateIplEvidenceBatch(JSON.parse(text));
}
if(process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]){
  loadReviewedIplEvidence().then(rows=>{
    console.log(JSON.stringify({mode:"offline-validation-only",candidates:rows.length,
      confirmedIplReports:rows.filter(r=>r.classification==="ipl_review_confirmed").length,
      confirmedIplCoverage:rows.filter(r=>r.classification==="ipl_coverage_confirmed").length,
      needsVerification:rows.filter(r=>r.classification==="needs_verification").length,
      records:rows.map(({handle,classification,device,sourceUrl})=>({handle,classification,device,sourceUrl}))},null,2));
    console.log("No database connection opened. No scores, status or outreach changed.");
  }).catch(()=>{console.error("IPL evidence review validation failed.");process.exitCode=1;});
}
