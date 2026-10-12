import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});
const migrationDir = path.join(root, "db", "migrations");
const files = (await readdir(migrationDir))
  .filter(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
const hashes = new Map();
for (const file of files) {
  hashes.set(file, createHash("sha256").update(await readFile(path.join(migrationDir, file))).digest("hex"));
}
await client.connect();
try {
  const table = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
  const applied = table.rows[0]?.name
    ? (await client.query("SELECT version, checksum FROM public.schema_migrations ORDER BY version")).rows
    : [];
  const unknown = applied.filter(row => !hashes.has(row.version));
  const modified = applied.filter(row => hashes.has(row.version) && hashes.get(row.version) !== row.checksum);
  const completed = new Set(applied.map(row => row.version));
  const pending = files.filter(file => !completed.has(file));
  console.log(`Migration files: ${files.length}; applied: ${applied.length}; pending: ${pending.length}`);
  for (const file of pending) console.log(`PENDING ${file}`);
  for (const row of unknown) console.error(`UNKNOWN APPLIED ${row.version}`);
  for (const row of modified) console.error(`CHECKSUM MISMATCH ${row.version}`);
  const lastApplied = applied.at(-1)?.version;
  const outOfOrder = lastApplied ? pending.filter(file => file < lastApplied) : [];
  for (const file of outOfOrder) console.error(`OUT OF ORDER ${file}`);
  if (unknown.length || modified.length || outOfOrder.length) {
    throw new Error("Migration history drift detected. Resolve before applying.");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `### Production migration plan\n\nApplied: ${applied.length} · Pending: ${pending.length}\n\n` +
      (pending.length ? pending.map(file => `- \`${file}\`\n`).join("") : "No pending migrations.\n"));
  }
} finally {
  await client.end();
}
