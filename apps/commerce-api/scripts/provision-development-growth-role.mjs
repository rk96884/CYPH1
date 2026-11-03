import pg from "pg";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const GROWTH_ROLE = "growth_import_dev";
export const DEVELOPMENT_DB = "cyph1_commerce_development";
export const REQUIRED_TABLES = Object.freeze([
  "audit_log", "outreach_drafts", "prospect_evidence", "prospects", "research_runs", "suppression_list"
]);

export function validateProvisioningInput({ action, confirmation, password }) {
  if (!["plan", "apply"].includes(action)) throw new Error("Unsupported action");
  if (action === "apply" && confirmation !== "CREATE-DEVELOPMENT-GROWTH-ROLE") {
    throw new Error("Explicit role-creation confirmation required");
  }
  if (action === "apply" && (typeof password !== "string" || password.length < 32 ||
      password.length > 256 || /[\r\n\0]/.test(password))) {
    throw new Error("A dedicated strong Growth import password secret is required");
  }
}

export async function verifyDevelopmentBaseline(query) {
  const identity = await query("SELECT current_database() AS name, current_user AS role");
  if (identity.rows[0]?.name !== DEVELOPMENT_DB) throw new Error("Wrong database: development only");
  const migration = await query(
    "SELECT COUNT(*)::integer AS total FROM public.schema_migrations WHERE version = '9000_growth_agent_foundation.sql'"
  );
  if (migration.rows[0]?.total !== 1) throw new Error("Growth migration not applied");
  const tables = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'growth' ORDER BY tablename");
  if (JSON.stringify(tables.rows.map(row => row.tablename)) !== JSON.stringify([...REQUIRED_TABLES].sort())) {
    throw new Error("Growth schema does not contain exactly the expected six tables");
  }
  const access = await query("SELECT has_schema_privilege('public','growth','USAGE') AS usable");
  if (access.rows[0]?.usable !== false) throw new Error("Growth schema unexpectedly public");
  const role = await query("SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = 'growth_import_dev'");
  if (role.rows.length) throw new Error("Role already exists: review before changing credentials or grants");
}

export async function provisionGrowthRole(client, password) {
  await client.query("BEGIN");
  try {
    // Use PostgreSQL's %L literal quoting for the secret, not string interpolation.
    // Never log statements or exception objects: they can contain credentials.
    const quoted = await client.query("SELECT format('CREATE ROLE growth_import_dev LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1) AS statement", [password]);
    await client.query(quoted.rows[0].statement);
    await client.query("GRANT USAGE ON SCHEMA growth TO growth_import_dev");
    await client.query("GRANT SELECT, INSERT ON growth.research_runs, growth.prospects, growth.prospect_evidence TO growth_import_dev");
    await client.query("GRANT UPDATE (status, completed_at) ON growth.research_runs TO growth_import_dev");
    await client.query("GRANT INSERT ON growth.audit_log TO growth_import_dev");
    await client.query("GRANT USAGE ON SEQUENCE growth.audit_log_id_seq TO growth_import_dev");
    // CONNECT may already be available to PUBLIC; this grant expresses required access.
    await client.query("GRANT CONNECT ON DATABASE cyph1_commerce_development TO growth_import_dev");
    await verifyRoleGrants(client.query.bind(client));
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Role provisioning failed; transaction rolled back");
  }
}

export async function verifyRoleGrants(query) {
  const role = await query(`
    SELECT rolcanlogin, rolcreatedb, rolcreaterole, rolsuper, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname = 'growth_import_dev'
  `);
  const r = role.rows[0];
  if (!r || r.rolcanlogin !== true || r.rolcreatedb || r.rolcreaterole || r.rolsuper || r.rolreplication || r.rolbypassrls) {
    throw new Error("Growth import role attributes are unsafe");
  }
  const grants = await query(`
    SELECT
      has_schema_privilege('growth_import_dev', 'growth', 'USAGE') AS growth_schema,
      has_table_privilege('growth_import_dev', 'growth.prospects', 'SELECT') AS prospects_read,
      has_table_privilege('growth_import_dev', 'growth.prospects', 'INSERT') AS prospects_insert,
      has_table_privilege('growth_import_dev', 'growth.prospect_evidence', 'INSERT') AS evidence_insert,
      has_table_privilege('growth_import_dev', 'growth.research_runs', 'INSERT') AS runs_insert,
      has_table_privilege('growth_import_dev', 'growth.audit_log', 'INSERT') AS audit_insert,
      has_sequence_privilege('growth_import_dev', 'growth.audit_log_id_seq', 'USAGE') AS audit_sequence,
      has_table_privilege('growth_import_dev', 'growth.outreach_drafts', 'SELECT,INSERT,UPDATE,DELETE') AS outreach_any,
      has_table_privilege('growth_import_dev', 'growth.suppression_list', 'SELECT,INSERT,UPDATE,DELETE') AS suppression_any,
      has_table_privilege('growth_import_dev', 'public.orders', 'SELECT,INSERT,UPDATE,DELETE') AS orders_any,
      has_table_privilege('growth_import_dev', 'public.payments', 'SELECT,INSERT,UPDATE,DELETE') AS payments_any,
      has_table_privilege('growth_import_dev', 'public.customers', 'SELECT,INSERT,UPDATE,DELETE') AS customers_any
  `);
  const p = grants.rows[0];
  const required = ["growth_schema","prospects_read","prospects_insert","evidence_insert","runs_insert","audit_insert","audit_sequence"];
  const denied = ["outreach_any","suppression_any","orders_any","payments_any","customers_any"];
  if (!p || required.some(key => p[key] !== true) || denied.some(key => p[key] !== false)) {
    throw new Error("Growth import role privilege verification failed");
  }
}

export async function main(environment = process.env) {
  const action = environment.ACTION;
  validateProvisioningInput({ action, confirmation: environment.CONFIRMATION, password: environment.GROWTH_IMPORT_ROLE_PASSWORD });
  if (!environment.DATABASE_URL) throw new Error("Development database secret required");
  const client = new pg.Client({
    connectionString: environment.DATABASE_URL,
    ssl: environment.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
  });
  try {
    await client.connect();
    if (action === "plan") {
      await verifyDevelopmentBaseline(client.query.bind(client));
      console.log("Development-only role preflight passed. Role absent; six Growth tables verified. No changes made.");
      return;
    }
    await verifyDevelopmentBaseline(client.query.bind(client));
    await provisionGrowthRole(client, environment.GROWTH_IMPORT_ROLE_PASSWORD);
    console.log("Dedicated growth_import_dev role created with restricted Growth-table access; commerce and outreach grants denied.");
  } finally {
    await client.end().catch(() => {});
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    // Never print DB connection errors or password-containing SQL statements.
    console.error("Development Growth role workflow failed; review preflight or privilege checks.");
    process.exitCode = 1;
  });
}
