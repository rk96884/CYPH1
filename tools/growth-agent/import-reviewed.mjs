import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";
import { prepareResearchBatch, ingestResearch } from "./ingest.mjs";

const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith("--"));
const apply = args.includes("--apply");
const confirmed = args.includes("--confirm=IMPORT-REVIEWED-RESEARCH");

async function main() {
  if (!file || args.some(arg => arg.startsWith("--") && !["--apply","--confirm=IMPORT-REVIEWED-RESEARCH"].includes(arg))) {
    throw new Error("Usage: node tools/growth-agent/import-reviewed.mjs file.json [--apply --confirm=IMPORT-REVIEWED-RESEARCH]");
  }
  const stat = await import("node:fs/promises").then(fs => fs.stat(file));
  if (stat.size > 128 * 1024) throw new Error("Research file too large (128 KiB maximum)");
  const batch = JSON.parse(await readFile(file, "utf8"));
  const entries = prepareResearchBatch(batch);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", records: entries.length,
    creators: entries.filter(x => x.channel === "creator").length,
    partners: entries.filter(x => x.channel === "partner").length,
    qualified: entries.map(x => ({ name: x.name, channel: x.channel, sourceUrl: x.sourceUrl,
      score: x.score, confidence: x.confidence, evidenceCount: x.evidence.length })) }, null, 2));
  if (!apply) { console.log("No database connection was opened. Nothing has been saved."); return; }
  if (!confirmed) throw new Error("Explicit confirmation required; no database changes made");
  const database = process.env.GROWTH_IMPORT_DATABASE_URL;
  if (!database) throw new Error("GROWTH_IMPORT_DATABASE_URL is required; use an isolated growth-only database role");
  if (process.env.GROWTH_IMPORT_ENV !== "development") {
    throw new Error("Only explicit development imports are permitted in this milestone");
  }
  const client = new pg.Client({ connectionString: database,
    ssl: process.env.GROWTH_IMPORT_DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    const db = await client.query("SELECT current_database() AS name, current_user AS role");
    const name = String(db.rows[0].name);
    if (!name.includes("development") || name.includes("production")) throw new Error("Refusing non-development database");
    const role = String(db.rows[0].role);
    if (!role.startsWith("growth_import_")) throw new Error("Dedicated growth_import_ database role required");
    const outcome = await ingestResearch(client, entries);
    console.log(JSON.stringify(outcome));
  } finally { await client.end(); }
}
main().catch(() => {
  // Suppress raw provider/connection errors: connection strings may include credentials.
  console.error("Research import failed. Check the input, database role, configuration and logs.");
  process.exitCode = 1;
});
