import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";
import { quotePostgresPassword } from "../../apps/commerce-api/scripts/provision-development-growth-role.mjs";

const EXPECTED = "cyph1_commerce_development";
const ROLE = "growth_read_dev";

export function verifyProvisionInputs(env) {
  if (!["plan","apply"].includes(env.ACTION)) throw Error("Unknown action");
  if (env.ACTION === "apply" && env.CONFIRMATION !== "CREATE-DEVELOPMENT-GROWTH-READER") throw Error("Confirmation required");
  if (env.ACTION === "apply" && (typeof env.GROWTH_READ_ROLE_PASSWORD !== "string" ||
      env.GROWTH_READ_ROLE_PASSWORD.length < 32 || env.GROWTH_READ_ROLE_PASSWORD.length > 256 ||
      /[\r\n\0]/.test(env.GROWTH_READ_ROLE_PASSWORD))) throw Error("Dedicated reader secret required");
  if (!env.DATABASE_URL || env.DATABASE_SSL !== "true") throw Error("Development TLS connection required");
}

export async function validateBaseline(query) {
  const r=await query("SELECT current_database() AS db, current_user AS actor");
  if (r.rows[0]?.db !== EXPECTED || r.rows[0]?.actor !== "cyph1_commerce_development_user") {
    throw Error("Unexpected development database or admin identity");
  }
  const m=await query("SELECT COUNT(*)::integer AS n FROM public.schema_migrations WHERE version='9000_growth_agent_foundation.sql'");
  if (m.rows[0]?.n !== 1) throw Error("Growth foundation absent");
  const tables=await query("SELECT count(*)::integer AS n FROM pg_catalog.pg_tables WHERE schemaname='growth'");
  if (tables.rows[0]?.n !== 6) throw Error("Unexpected Growth schema");
  const role=await query("SELECT rolname FROM pg_roles WHERE rolname='growth_read_dev'");
  if (role.rows.length) throw Error("Reader role already exists: stop and inspect, do not rotate automatically");
}

export async function verifyReader(query) {
  const r=await query(`SELECT r.rolcanlogin, r.rolsuper, r.rolcreaterole, r.rolcreatedb,
    r.rolreplication, r.rolbypassrls,
    has_schema_privilege('growth_read_dev','growth','USAGE') AS schema_read,
    has_table_privilege('growth_read_dev','growth.prospects','SELECT') AS prospects_read,
    has_table_privilege('growth_read_dev','growth.prospect_evidence','SELECT') AS evidence_read,
    has_table_privilege('growth_read_dev','growth.prospects','INSERT,UPDATE,DELETE') AS prospects_write,
    has_table_privilege('growth_read_dev','growth.research_runs','SELECT,INSERT,UPDATE,DELETE') AS research_runs_any,
    has_table_privilege('growth_read_dev','growth.audit_log','SELECT,INSERT,UPDATE,DELETE') AS audit_any,
    has_table_privilege('growth_read_dev','growth.outreach_drafts','SELECT,INSERT,UPDATE,DELETE') AS outreach_any,
    has_table_privilege('growth_read_dev','growth.suppression_list','SELECT,INSERT,UPDATE,DELETE') AS suppression_any,
    has_table_privilege('growth_read_dev','public.orders','SELECT,INSERT,UPDATE,DELETE') AS commerce_orders,
    has_table_privilege('growth_read_dev','public.customers','SELECT,INSERT,UPDATE,DELETE') AS commerce_customers,
    has_table_privilege('growth_read_dev','public.payments','SELECT,INSERT,UPDATE,DELETE') AS commerce_payments
  FROM pg_roles r WHERE r.rolname='growth_read_dev'`);
  const p=r.rows[0];
  if (!p || p.rolcanlogin!==true || p.rolsuper || p.rolcreaterole || p.rolcreatedb ||
      p.rolreplication || p.rolbypassrls || !p.schema_read || !p.prospects_read || !p.evidence_read ||
      p.prospects_write || p.research_runs_any || p.audit_any || p.outreach_any || p.suppression_any ||
      p.commerce_orders || p.commerce_customers || p.commerce_payments) throw Error("Reader role has unsafe privileges");
}

export async function provisionReader(client, password) {
  await client.query("BEGIN");
  try {
    await client.query("CREATE ROLE growth_read_dev LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD " + quotePostgresPassword(password));
    await client.query("GRANT CONNECT ON DATABASE cyph1_commerce_development TO growth_read_dev");
    await client.query("GRANT USAGE ON SCHEMA growth TO growth_read_dev");
    await client.query("GRANT SELECT ON growth.prospects, growth.prospect_evidence TO growth_read_dev");
    await verifyReader(client.query.bind(client));
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(()=>{});
    throw Error("Reader provisioning rolled back; check role grants");
  }
}

export async function main(env=process.env) {
  verifyProvisionInputs(env);
  const client=new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
  try {
    await client.connect();
    await validateBaseline(client.query.bind(client));
    if (env.ACTION==="plan") {
      console.log("Growth dashboard reader preflight passed: no changes.");
      return;
    }
    await provisionReader(client,env.GROWTH_READ_ROLE_PASSWORD);
    console.log("Dedicated development Growth read-only account created; grants verified.");
  } finally { await client.end().catch(()=>{}); }
}
if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  main().catch(()=>{console.error("Development reader role operation failed; review identity, secret and privileges.");process.exitCode=1;});
}
