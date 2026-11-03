import pg from "pg";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadReviewedIplEvidence } from "./ipl-evidence.mjs";
import { buildRestrictedUrl } from "./check-development-import-connection.mjs";

const BASE = "https://www.instagram.com/";
const IDENTITY = Object.freeze({
  beautygeeksascha: BASE+"beautygeeksascha/",
  backtoyoubeauty: BASE+"backtoyoubeauty/",
  nlondors: BASE+"nlondors/",
  skinandbase: BASE+"skinandbase/",
  lifeofhanna_: BASE+"lifeofhanna_/"
});
const CONFIRM = "IMPORT-IPL-EVIDENCE-RESEARCH-ONLY";
export function verifyIplImportAction(env) {
  if (!["plan","apply"].includes(env.ACTION)) throw Error("Invalid action");
  if (env.ACTION==="apply" && (env.CONFIRMATION!==CONFIRM ||
     env.DATABASE_SSL!=="true")) throw Error("Explicit development-only confirmation and external TLS required");
}

const expectedRow=(id,row)=>({
  prospect_id:id,policy_version:1,classification:row.classification,device:row.device,
  technology:row.technology,evidence_url:row.sourceUrl,published_at:row.publishedAt,
  checked_at:row.checkedAt,firsthand_test_confirmed:row.firsthandTestConfirmed,
  content_format:row.format,evidence_note:row.note
});
const isoDate=value=>value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);
const comparable=(row)=>JSON.stringify({
  classification:row.classification,device:row.device,technology:row.technology,
  evidence_url:row.evidence_url,published_at:row.published_at ? isoDate(row.published_at):null,
  checked_at:isoDate(row.checked_at),
  firsthand_test_confirmed:row.firsthand_test_confirmed,content_format:row.content_format,
  evidence_note:row.evidence_note
});

export async function verifyIplImportConnection(query) {
  const result=await query(`SELECT current_database() AS db,current_user AS actor,
    has_table_privilege(current_user,'growth.ipl_experience','SELECT') AS ipl_select,
    has_table_privilege(current_user,'growth.ipl_experience','INSERT') AS ipl_insert,
    has_table_privilege(current_user,'growth.ipl_experience','UPDATE,DELETE') AS ipl_mutate,
    has_table_privilege(current_user,'growth.audit_log','INSERT') AS audit_insert,
    has_table_privilege('growth_read_dev','growth.ipl_experience','SELECT') AS reader_select,
    has_table_privilege('growth_read_dev','growth.ipl_experience','INSERT,UPDATE,DELETE') AS reader_write,
    has_table_privilege(current_user,'public.orders','SELECT,INSERT,UPDATE,DELETE') AS commerce
  `);
  const p=result.rows?.[0];
  if(!p || p.db!=="cyph1_commerce_development" || p.actor!=="growth_import_dev" ||
     !p.ipl_select || !p.ipl_insert || p.ipl_mutate || !p.audit_insert ||
     !p.reader_select || p.reader_write || p.commerce) throw Error("Restricted IPL import account invalid");
}

export async function importReviewedIplResearch(client,reviewed) {
  if(!Array.isArray(reviewed) || reviewed.length!==5) throw Error("Exactly five reviewed sources required");
  await client.query("BEGIN");
  try{
    const outcome={inserted:0,unchanged:0};
    for(const row of reviewed){
      const source=IDENTITY[row.handle];
      if(!source) throw Error("Unapproved pilot handle");
      const found=await client.query(
        "SELECT id, review_status FROM growth.prospects WHERE channel='creator' AND source_url=$1",
        [source]
      );
      if(found.rows.length!==1 || found.rows[0].review_status!=="research_only") {
        throw Error("Pilot creator missing or no longer research_only");
      }
      const entry=expectedRow(found.rows[0].id,row);
      const inserted=await client.query(`INSERT INTO growth.ipl_experience
        (prospect_id,policy_version,classification,device,technology,evidence_url,
         published_at,checked_at,firsthand_test_confirmed,content_format,evidence_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (prospect_id,policy_version) DO NOTHING RETURNING id`,
        Object.values(entry)
      );
      if(inserted.rows.length){
        outcome.inserted++;
        await client.query(`INSERT INTO growth.audit_log
          (actor_id,action,target_type,target_id,details)
          VALUES ('reviewed-ipl-research','research.ipl_evidence_import','prospect',$1,$2::jsonb)`,
          [entry.prospect_id,JSON.stringify({policyVersion:1,classification:row.classification,sourceUrl:row.sourceUrl})]
        );
      }else{
        const previous=await client.query(
          "SELECT * FROM growth.ipl_experience WHERE prospect_id=$1 AND policy_version=1",
          [entry.prospect_id]
        );
        if(previous.rows.length!==1 || comparable(previous.rows[0])!==comparable(entry)) {
          throw Error("Existing evidence differs; never silently rewrite research history");
        }
        outcome.unchanged++;
      }
    }
    await client.query("COMMIT");
    return Object.freeze({...outcome,researchOnly:true,outreachEnabled:false,scoresChanged:false});
  }catch{
    await client.query("ROLLBACK").catch(()=>{});
    throw Error("IPL import transaction rolled back");
  }
}

export async function main(env=process.env) {
  verifyIplImportAction(env);
  const reviewed=await loadReviewedIplEvidence();
  console.log(JSON.stringify({action:env.ACTION,candidates:reviewed.map(r=>({
    handle:r.handle,classification:r.classification,device:r.device,sourceUrl:r.sourceUrl
  }))},null,2));
  if(env.ACTION==="plan"){
    console.log("Offline IPL evidence plan valid. No connection or writes.");
    return;
  }
  const restricted=buildRestrictedUrl(env.DEVELOPMENT_DATABASE_URL,env.GROWTH_IMPORT_ROLE_PASSWORD);
  const client=new pg.Client({connectionString:restricted,ssl:{rejectUnauthorized:true}});
  try{
    await client.connect();
    await verifyIplImportConnection(client.query.bind(client));
    const result=await importReviewedIplResearch(client,reviewed);
    console.log(JSON.stringify({result:"IPL research-only import verified",...result}));
  }finally{await client.end().catch(()=>{});}
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  main().catch(()=>{
    console.error("Development-only IPL import failed. Review schema, grants and source integrity.");
    process.exitCode=1;
  });
}
