import pg from "pg";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function buildRestrictedUrl(ownerUrl, password) {
  if (!ownerUrl || typeof password !== "string" || password.length < 32 ||
      password.length > 256 || /[\r\n\0]/.test(password)) {
    throw new Error("Development connection inputs missing or invalid");
  }
  let url;
  try { url = new URL(ownerUrl); }
  catch { throw new Error("Invalid development database URL"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
      !url.hostname || !url.username || !url.pathname ||
      decodeURIComponent(url.pathname.slice(1)) !== "cyph1_commerce_development") {
    throw new Error("Development-only database identity required");
  }
  // Reuse only the development database host, port, name and SSL settings;
  // never authenticate as the commerce owner for this connectivity test.
  url.username = "growth_import_dev";
  url.password = password;
  url.searchParams.delete("options");
  return url.toString();
}

export async function verifyRestrictedConnection(query) {
  const identity = await query("SELECT current_database() AS name, current_user AS role");
  if (identity.rows[0]?.name !== "cyph1_commerce_development" ||
      identity.rows[0]?.role !== "growth_import_dev") {
    throw new Error("Unexpected database or account identity");
  }
  const access = await query(`
    SELECT
      has_schema_privilege(current_user, 'growth', 'USAGE') AS growth_schema,
      has_table_privilege(current_user, 'growth.prospects', 'SELECT') AS prospects_read,
      has_table_privilege(current_user, 'growth.prospects', 'INSERT') AS prospects_insert,
      has_table_privilege(current_user, 'growth.prospect_evidence', 'INSERT') AS evidence_insert,
      has_table_privilege(current_user, 'growth.research_runs', 'INSERT') AS runs_insert,
      has_table_privilege(current_user, 'growth.audit_log', 'INSERT') AS audit_insert,
      has_table_privilege(current_user, 'public.customers', 'SELECT,INSERT,UPDATE,DELETE') AS customers_any,
      has_table_privilege(current_user, 'public.orders', 'SELECT,INSERT,UPDATE,DELETE') AS orders_any,
      has_table_privilege(current_user, 'public.payments', 'SELECT,INSERT,UPDATE,DELETE') AS payments_any,
      has_table_privilege(current_user, 'growth.outreach_drafts', 'SELECT,INSERT,UPDATE,DELETE') AS outreach_any,
      has_table_privilege(current_user, 'growth.suppression_list', 'SELECT,INSERT,UPDATE,DELETE') AS suppression_any
  `);
  const permissions = access.rows[0];
  const allow = ["growth_schema","prospects_read","prospects_insert","evidence_insert","runs_insert","audit_insert"];
  const deny = ["customers_any","orders_any","payments_any","outreach_any","suppression_any"];
  if (!permissions || allow.some(key => permissions[key] !== true) ||
      deny.some(key => permissions[key] !== false)) {
    throw new Error("Restricted account permissions failed validation");
  }
  const result = await query("SELECT COUNT(*)::integer AS total FROM growth.prospects");
  if (!Number.isInteger(result.rows[0]?.total)) throw new Error("Restricted read query failed");
  return result.rows[0].total;
}

export async function main(env = process.env) {
  if (env.ACTION !== "check") throw new Error("Read-only check action required");
  if (env.DATABASE_SSL !== "true") throw new Error("External TLS required");
  const url = buildRestrictedUrl(env.DEVELOPMENT_DATABASE_URL, env.GROWTH_IMPORT_ROLE_PASSWORD);
  const client = new pg.Client({ connectionString:url, ssl:{rejectUnauthorized:true} });
  try {
    await client.connect();
    const count = await verifyRestrictedConnection(client.query.bind(client));
    console.log("Restricted development Growth importer authenticated; least-privilege read checks passed.");
    console.log("Existing prospect records: " + count + ". No database writes performed.");
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    // Do not print raw provider errors: they can include credentials or URLs.
    console.error("Growth importer connection smoke test failed. Verify development-only secrets and permissions.");
    process.exitCode = 1;
  });
}
