import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const applicationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const createClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  return new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
};

const checksum = (contents) => createHash("sha256").update(contents).digest("hex");

export const migrate = async () => {
  const client = createClient();
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [73012026]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationDirectory = path.join(applicationRoot, "db", "migrations");
    const files = (await readdir(migrationDirectory))
      .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
      .sort();
    let appliedCount = 0;

    for (const file of files) {
      const sql = await readFile(path.join(migrationDirectory, file), "utf8");
      const digest = checksum(sql);
      const existing = await client.query(
        "SELECT checksum FROM schema_migrations WHERE version = $1",
        [file],
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0].checksum !== digest) {
          throw new Error(`Previously applied migration was modified: ${file}`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [file, digest],
        );
        await client.query("COMMIT");
        appliedCount += 1;
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    if (appliedCount === 0) {
      console.log(`Database schema is up to date (${files.length} migration${files.length === 1 ? "" : "s"}).`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [73012026]).catch(() => undefined);
    await client.end();
  }
};

export const runDevelopmentSeed = async () => {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEVELOPMENT_SEED !== "true") {
    throw new Error("Development seed is disabled. Set ALLOW_DEVELOPMENT_SEED=true outside production.");
  }

  const client = createClient();
  const sql = await readFile(path.join(applicationRoot, "db", "seeds", "development.sql"), "utf8");
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied non-production development seed.");
  } finally {
    await client.end();
  }
};
