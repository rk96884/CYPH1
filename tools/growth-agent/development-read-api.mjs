import { createServer } from "node:http";
import process from "node:process";
import pg from "pg";
import { loadDevelopmentAuth, createDevelopmentAuthenticator } from "./development-auth.mjs";

const HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
});
const fail = (status, message) => ({ status, body: { message } });

// The Render development database's private hostname. This is deliberately not
// configurable by the client or the application's environment.
export const DEVELOPMENT_INTERNAL_DB_HOST = "dpg-da9hpq1srm7s73cdb260-a";
export function developmentDatabaseConnection(urlString) {
  if (!urlString) throw Error("Separate development read-only database URL is required");
  let url;
  try { url = new URL(urlString); }
  catch { throw Error("Invalid development database URL"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
      url.hostname !== DEVELOPMENT_INTERNAL_DB_HOST ||
      (url.port && url.port !== "5432") ||
      decodeURIComponent(url.pathname.slice(1)) !== "cyph1_commerce_development" ||
      decodeURIComponent(url.username) !== "growth_read_dev" ||
      !url.password || url.hash || url.search || url.hostname.includes(":")) {
    throw Error("Dedicated Render internal development database and growth_read_dev role required");
  }
  return Object.freeze({
    connectionString: urlString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    options: "-c default_transaction_read_only=on",
  });
}

// Never log raw connection errors: some include connection strings or secrets.
export function databaseStartupFailureCode(error) {
  if (error?.message === "Development read-only account validation failed") return "DB_ROLE_BOUNDARY_INVALID";
  const codes = {
    "28P01": "DB_AUTHENTICATION_FAILED", "28000": "DB_AUTHENTICATION_FAILED",
    "42501": "DB_PERMISSION_DENIED", "3D000": "DB_DATABASE_NOT_FOUND",
    "42P01": "DB_REQUIRED_TABLE_MISSING", "3F000": "DB_REQUIRED_SCHEMA_MISSING",
    "ENOTFOUND": "DB_HOST_UNRESOLVED", "ECONNREFUSED": "DB_CONNECTION_REFUSED",
    "ETIMEDOUT": "DB_CONNECTION_TIMEOUT", "ECONNRESET": "DB_CONNECTION_RESET",
    "DEPTH_ZERO_SELF_SIGNED_CERT": "DB_TLS_CERTIFICATE_INVALID",
    "SELF_SIGNED_CERT_IN_CHAIN": "DB_TLS_CERTIFICATE_INVALID",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE": "DB_TLS_CERTIFICATE_INVALID",
    "ERR_TLS_CERT_ALTNAME_INVALID": "DB_TLS_HOSTNAME_INVALID",
    "CERT_HAS_EXPIRED": "DB_TLS_CERTIFICATE_EXPIRED",
  };
  return Object.hasOwn(codes, error?.code) ? codes[error.code] : "DB_CONNECTION_OR_VALIDATION_FAILED";
}

export function validateDevelopmentApiEnvironment(env) {
  if (env.GROWTH_DATA_ENV !== "development") throw Error("Development-only mode required");
  const database = developmentDatabaseConnection(env.GROWTH_DEV_READ_DATABASE_URL);
  const origin = new URL(env.GROWTH_DEV_UI_ORIGIN || "");
  if (!["https:", "http:"].includes(origin.protocol) ||
      (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) ||
      origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw Error("Exact secure development UI origin required");
  }
  if (["www.cyph1.co.uk", "cyph1.co.uk"].includes(origin.hostname)) {
    throw Error("Production website origin refused");
  }
  const auth = loadDevelopmentAuth(env);
  return { database, uiOrigin:origin.origin, auth };
}

export async function validateReadOnlyDatabase(query) {
  const result = await query(`SELECT current_database() AS db, current_user AS actor,
    has_table_privilege(current_user,'growth.prospects','SELECT') AS can_read,
    has_table_privilege(current_user,'growth.prospect_evidence','SELECT') AS can_read_evidence,
    has_table_privilege(current_user,'growth.prospects','INSERT,UPDATE,DELETE') AS can_write,
    has_table_privilege(current_user,'public.customers','SELECT,INSERT,UPDATE,DELETE') AS commerce,
    has_table_privilege(current_user,'public.orders','SELECT,INSERT,UPDATE,DELETE') AS orders,
    has_table_privilege(current_user,'growth.outreach_drafts','SELECT,INSERT,UPDATE,DELETE') AS outreach
  `);
  const row = result.rows?.[0];
  if (!row || row.db !== "cyph1_commerce_development" || row.actor !== "growth_read_dev" ||
      row.can_read !== true || row.can_read_evidence !== true ||
      row.can_write !== false || row.commerce !== false || row.orders !== false || row.outreach !== false) {
    throw Error("Development read-only account validation failed");
  }
}

export async function readDevelopmentProspects(query) {
  const result = await query(`
    SELECT p.id, p.channel, p.display_name, p.source_url, p.source_checked_at,
      p.review_status, p.qualification_score, p.qualification_confidence,
      COUNT(e.id)::integer AS evidence_count,
      ix.classification AS ipl_classification, ix.device AS ipl_device,
      ix.technology AS ipl_technology, ix.evidence_url AS ipl_source_url,
      ix.published_at AS ipl_published_at, ix.checked_at AS ipl_checked_at,
      ix.firsthand_test_confirmed AS ipl_firsthand,
      ix.content_format AS ipl_format, ix.evidence_note AS ipl_note
    FROM growth.prospects p
    LEFT JOIN growth.prospect_evidence e ON e.prospect_id=p.id
    LEFT JOIN growth.ipl_experience ix ON ix.prospect_id=p.id AND ix.policy_version=1
    GROUP BY p.id, ix.id
    ORDER BY p.qualification_score DESC, p.source_checked_at DESC, p.id
    LIMIT 100
  `);
  return result.rows.map(row=>({
    id:String(row.id), channel:row.channel, name:String(row.display_name),
    sourceUrl:String(row.source_url), checkedAt:new Date(row.source_checked_at).toISOString(),
    status:row.review_status, score:Number(row.qualification_score),
    confidence:Number(row.qualification_confidence), evidenceCount:Number(row.evidence_count),
    iplExperience: row.ipl_classification ? {
      classification:row.ipl_classification, device:row.ipl_device,
      technology:row.ipl_technology, sourceUrl:row.ipl_source_url,
      publishedAt:row.ipl_published_at ? new Date(row.ipl_published_at).toISOString().slice(0,10) : null,
      checkedAt:new Date(row.ipl_checked_at).toISOString().slice(0,10),
      firsthandTestConfirmed:row.ipl_firsthand === true,
      format:row.ipl_format, note:row.ipl_note
    } : null
  }));
}

export function createDevelopmentGrowthHandler({ uiOrigin, authenticate, readProspects }) {
  return async function handle({ method, path, origin, token }) {
    if (method === "OPTIONS") {
      return origin === uiOrigin ? {status:204, body:null} : fail(403,"Forbidden");
    }
    if (path !== "/operations/growth/prospects") return fail(404,"Not found");
    if (method !== "GET") return fail(405,"Method not allowed");
    if (!token) return fail(401,"Access denied");
    const permitted = await authenticate(token);
    if (!permitted) return fail(401,"Access denied");
    return {status:200, body:{prospects:await readProspects(),readOnly:true,environment:"development"}};
  };
}

export async function run(env=process.env) {
  const config=validateDevelopmentApiEnvironment(env);

  const pool=new pg.Pool(config.database);
  try {
    await validateReadOnlyDatabase(pool.query.bind(pool));
  } catch (error) {
    await pool.end();
    const failure = Error("Restricted development database validation failed");
    failure.safeStartupCode = databaseStartupFailureCode(error);
    throw failure;
  }
  const handler=createDevelopmentGrowthHandler({
    uiOrigin:config.uiOrigin,
    authenticate:createDevelopmentAuthenticator(config.auth),
    readProspects:()=>readDevelopmentProspects(pool.query.bind(pool))
  });
  const port=Number(env.PORT||"3000");
  if (!Number.isInteger(port)||port<1||port>65535) throw Error("Invalid PORT");
  const server=createServer(async(req,res)=>{
    const origin=req.headers.origin;
    const cors=origin===config.uiOrigin?{
      "Access-Control-Allow-Origin":config.uiOrigin,
      "Access-Control-Allow-Credentials":"true",
      "Access-Control-Allow-Methods":"GET, OPTIONS",
      "Access-Control-Allow-Headers":"Accept, Authorization",
      "Vary":"Origin"}:{};
    let result;
    try {
      result=await handler({method:req.method,path:new URL(req.url||"/","https://local.invalid").pathname,
        origin,token:req.headers.authorization});
    } catch {result=fail(503,"Development research unavailable");}
    res.writeHead(result.status,{...HEADERS,...cors});
    res.end(result.body===null?"":JSON.stringify(result.body));
  });
  server.listen(port,"0.0.0.0");
  console.log("CYPH/1 development growth read-only API started");
  process.once("SIGTERM",()=>server.close(()=>void pool.end()));
}

if (process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]) {
  run().catch(error=>{
    console.error("Development Growth API startup failed:", error.safeStartupCode || "CONFIGURATION_INVALID");
    process.exitCode=1;
  });
}
