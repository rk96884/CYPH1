import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import process from "node:process";
import { buildRestrictedUrl, verifyRestrictedConnection } from "./check-development-import-connection.mjs";
import { prepareResearchBatch, ingestResearch } from "./ingest.mjs";

export const PILOT_SOURCES = Object.freeze([
  "https://www.instagram.com/skinandbase/",
  "https://www.instagram.com/backtoyoubeauty/",
  "https://www.instagram.com/beautygeeksascha/",
  "https://www.instagram.com/nlondors/",
  "https://www.instagram.com/lifeofhanna_/"
]);

export function verifyPilotBatch(batch) {
  if (!batch || typeof batch !== "object" || !Array.isArray(batch.prospects) ||
      batch.prospects.length !== 5) throw new Error("Exactly five pilot candidates required");
  const sources = batch.prospects.map(item => item?.sourceUrl);
  if (JSON.stringify(sources) !== JSON.stringify(PILOT_SOURCES)) {
    throw new Error("Unexpected pilot candidate sources or order");
  }
  for (const item of batch.prospects) {
    if (!item || item.channel !== "creator") throw new Error("Creators only");
    const allowed = new Set(["name", "channel", "sourceUrl", "sourceCheckedAt", "evidence"]);
    if (Object.keys(item).some(key => !allowed.has(key))) {
      throw new Error("Unexpected candidate data field");
    }
    if (Object.keys(item.evidence || {}).some(key => !["relevance", "ukAudience", "engagement", "brandFit", "feasibility"].includes(key))) {
      throw new Error("Unrecognised evidence dimension");
    }
    // UK creator location does not prove a UK follower audience.
    if ("ukAudience" in (item.evidence || {}) || "engagement" in (item.evidence || {})) {
      throw new Error("UK audience or engagement claims are not yet verified");
    }
  }
  const entries = prepareResearchBatch(batch);
  if (entries.length !== 5 || entries.some(item => item.channel !== "creator")) {
    throw new Error("Unexpected qualified pilot batch");
  }
  return entries;
}

export function verifyAction({ action, confirmation }) {
  if (!["plan", "apply"].includes(action)) throw new Error("Action must be plan or apply");
  if (action === "apply" && confirmation !== "IMPORT-FIVE-RESEARCH-ONLY-DEV") {
    throw new Error("Explicit development-only research import confirmation required");
  }
}

export async function main(env = process.env) {
  verifyAction({ action: env.ACTION, confirmation: env.CONFIRMATION });
  const file = new URL("../../docs/growth/research/first-five-uk-creators.json", import.meta.url);
  const batch = JSON.parse(await readFile(file, "utf8"));
  const entries = verifyPilotBatch(batch);
  console.log("Pilot candidates: " + entries.length);
  for (const p of entries) {
    console.log(JSON.stringify({ name:p.name, score:p.score, evidenceCount:p.evidence.length, confidence:p.confidence, reviewStatus:"research_only" }));
  }
  if (env.ACTION === "plan") {
    console.log("Research-only pilot plan passed. No database connection or writes.");
    return;
  }
  if (env.DATABASE_SSL !== "true") throw new Error("External database TLS must be enabled");
  const url = buildRestrictedUrl(env.DEVELOPMENT_DATABASE_URL, env.GROWTH_IMPORT_ROLE_PASSWORD);
  const client = new pg.Client({ connectionString:url, ssl:{ rejectUnauthorized:true } });
  try {
    await client.connect();
    const countBefore = await verifyRestrictedConnection(client.query.bind(client));
    const outcome = await ingestResearch(client, entries);
    const countAfter = await client.query("SELECT COUNT(*)::integer AS total FROM growth.prospects");
    if (countAfter.rows[0]?.total !== countBefore + outcome.inserted ||
        outcome.inserted + outcome.skipped !== entries.length ||
        outcome.outreachEnabled !== false) {
      throw new Error("Post-import research totals inconsistent; investigate before subsequent batches");
    }
    console.log(JSON.stringify({ result:"development-import-complete", inserted:outcome.inserted,
      skipped:outcome.skipped, prospectsBefore:countBefore, prospectsAfter:countAfter.rows[0].total,
      researchOnly:true, outreachEnabled:false }));
    console.log("No outreach performed. Independent read-only audit verification is required.");
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    // Do not reveal provider errors, passwords, URLs or secrets in Actions logs.
    console.error("Development research-only pilot failed. Review batch, account permissions and workflow inputs.");
    process.exitCode = 1;
  });
}
