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
    const iplMigration = await client.query(
      "SELECT version FROM public.schema_migrations WHERE version = $1",
      ["9001_growth_ipl_experience.sql"]
    );
    const iplTable = await client.query("SELECT to_regclass('growth.ipl_experience') AS name");
    if ((iplMigration.rowCount === 1) !== Boolean(iplTable.rows[0]?.name)) {
      throw new Error("IPL experience schema does not match migration history");
    }
    if (iplMigration.rowCount === 1) {
      const iplColumns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='growth' AND table_name='ipl_experience'");
      const names = new Set(iplColumns.rows.map(row => row.column_name));
      for (const required of ["prospect_id","policy_version","classification","device","technology","evidence_url","published_at","checked_at","firsthand_test_confirmed","content_format","evidence_note"]) {
        if (!names.has(required)) throw new Error("IPL evidence column absent");
      }
    }
    console.log("Growth schema verified: base six tables" + (iplMigration.rowCount === 1 ? " plus IPL experience" : "") + ", migration history and PUBLIC access checked.");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
