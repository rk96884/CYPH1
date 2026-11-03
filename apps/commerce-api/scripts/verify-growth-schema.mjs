import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required; this command is read-only and does not run migrations.");
  process.exitCode = 1;
} else {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
  });
  const expected = ["research_runs", "prospects", "prospect_evidence", "outreach_drafts", "audit_log", "suppression_list"];
  try {
    await client.connect();
    const result = await client.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname=$1 AND tablename = ANY($2::text[])",
      ["growth", expected]
    );
    const found = new Set(result.rows.map(r => r.tablename));
    const missing = expected.filter(x => !found.has(x));
    if (missing.length) throw new Error("Missing growth tables: " + missing.join(", "));
    const grants = await client.query(
      `SELECT EXISTS (SELECT 1 FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl WHERE n.nspname = 'growth' AND acl.grantee = 0 AND acl.privilege_type = 'USAGE') AS has_usage`
    );
    if (grants.rows[0]?.has_usage) throw new Error("growth schema is unexpectedly available to PUBLIC");
    const migration = await client.query(
      "SELECT version FROM public.schema_migrations WHERE version = $1",
      ["9000_growth_agent_foundation.sql"]
    );
    if (migration.rowCount !== 1) throw new Error("Growth migration not tracked by existing runner");
    console.log("Growth schema verified: six tables, migration tracked, PUBLIC schema access revoked.");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
