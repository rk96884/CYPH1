import pg from "pg";
import process from "node:process";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Development database URL is required");
const client = new pg.Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});
try {
  await client.connect();
  const identity = await client.query("SELECT current_database() AS database_name, current_user AS role_name");
  const { database_name: name, role_name: role } = identity.rows[0];
  if (name !== "cyph1_commerce_development") {
    throw new Error("Database identity mismatch: refusing to operate outside CYPH/1 development");
  }
  const rows = await client.query("SELECT version FROM public.schema_migrations ORDER BY version");
  const applied = new Set(rows.rows.map(row => row.version));
  const growth = await client.query("SELECT count(*)::integer AS total FROM pg_catalog.pg_tables WHERE schemaname = 'growth'");
  const growthTables = growth.rows[0].total;
  const target = "9000_growth_agent_foundation.sql";
  if (applied.has(target)) {
    if (growthTables !== 6) throw new Error("Growth migration recorded but table count differs from six");
    console.log("Development growth migration already applied: all six tables present");
  } else {
    if (growthTables !== 0) throw new Error("Growth objects exist without migration history; review manually");
    if (applied.size !== 20 || !applied.has("0020_inpost_collection_review.sql")) {
      throw new Error("Unexpected development baseline; review migration history before applying");
    }
    console.log("Development preflight passed: 20 migrations applied and growth schema absent");
  }
  console.log("Database identity verified for development; role details intentionally omitted");
} catch {
  console.error("Development migration preflight failed. Check database identity, schema history and credentials.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
