import { createServer } from "node:http";
import process from "node:process";
import pg from "pg";
import { createRemoteJWKSet, jwtVerify } from "jose";

const HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
});
const fail = (status, message) => ({ status, body: { message } });

export function validateDevelopmentApiEnvironment(env) {
  if (env.GROWTH_DATA_ENV !== "development") throw Error("Development-only mode required");
  if (!env.GROWTH_DEV_READ_DATABASE_URL) throw Error("Separate development read-only database URL is required");
  const database = new URL(env.GROWTH_DEV_READ_DATABASE_URL);
  if (!["postgresql:", "postgres:"].includes(database.protocol) ||
      decodeURIComponent(database.pathname.slice(1)) !== "cyph1_commerce_development" ||
      decodeURIComponent(database.username) !== "growth_read_dev" ||
      !database.password) throw Error("Dedicated development growth_read_dev account required");
  const origin = new URL(env.GROWTH_DEV_UI_ORIGIN || "");
  if (!["https:", "http:"].includes(origin.protocol) ||
      (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) ||
      origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw Error("Exact secure development UI origin required");
  }
  if (["www.cyph1.co.uk", "cyph1.co.uk"].includes(origin.hostname)) {
    throw Error("Production website origin refused");
  }
  const team = new URL(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || "");
  if (team.protocol !== "https:" || !team.hostname.endsWith(".cloudflareaccess.com") ||
      team.pathname !== "/" || team.search || team.hash) {
    throw Error("Invalid Cloudflare Access team origin");
  }
  if (!env.CLOUDFLARE_ACCESS_AUDIENCE) throw Error("Access audience required");
  let grants;
  try { grants = JSON.parse(env.OPERATIONS_ACCESS_GRANTS || "{}"); }
  catch { throw Error("Invalid Access grants"); }
  if (!grants || typeof grants !== "object" || Array.isArray(grants)) throw Error("Invalid Access grants");
  for (const [email, permissions] of Object.entries(grants)) {
    if (!email.includes("@") || !Array.isArray(permissions) ||
        permissions.some(value => value !== "growth:read")) {
      throw Error("Development endpoint grants must contain only growth:read");
    }
  }
  return { database:env.GROWTH_DEV_READ_DATABASE_URL, uiOrigin:origin.origin,
    team:team.origin, audience:env.CLOUDFLARE_ACCESS_AUDIENCE,
    grants:new Set(Object.entries(grants).filter(([,p])=>p.includes("growth:read")).map(([email])=>email.toLowerCase())) };
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
      COUNT(e.id)::integer AS evidence_count
    FROM growth.prospects p
    LEFT JOIN growth.prospect_evidence e ON e.prospect_id=p.id
    GROUP BY p.id
    ORDER BY p.qualification_score DESC, p.source_checked_at DESC, p.id
    LIMIT 100
  `);
  return result.rows.map(row=>({
    id:String(row.id), channel:row.channel, name:String(row.display_name),
    sourceUrl:String(row.source_url), checkedAt:new Date(row.source_checked_at).toISOString(),
    status:row.review_status, score:Number(row.qualification_score),
    confidence:Number(row.qualification_confidence), evidenceCount:Number(row.evidence_count)
  }));
}

export function createDevelopmentGrowthHandler({ uiOrigin, authenticate, readProspects }) {
  return async function handle({ method, path, origin, token }) {
    if (method === "OPTIONS") {
      return origin === uiOrigin ? {status:204, body:null} : fail(403,"Forbidden");
    }
    if (path !== "/operations/growth/prospects") return fail(404,"Not found");
    if (method !== "GET") return fail(405,"Method not allowed");
    if (!token) return fail(403,"Access denied");
    const permitted = await authenticate(token);
    if (!permitted) return fail(403,"Access denied");
    return {status:200, body:{prospects:await readProspects(),readOnly:true,environment:"development"}};
  };
}

export async function run(env=process.env) {
  const config=validateDevelopmentApiEnvironment(env);
  const jwks=createRemoteJWKSet(new URL(config.team+"/cdn-cgi/access/certs"));
  const pool=new pg.Pool({connectionString:config.database,ssl:{rejectUnauthorized:true},max:3,
    options:"-c default_transaction_read_only=on"});
  try {
    await validateReadOnlyDatabase(pool.query.bind(pool));
  } catch {
    await pool.end();
    throw Error("Restricted development database validation failed");
  }
  const handler=createDevelopmentGrowthHandler({
    uiOrigin:config.uiOrigin,
    authenticate:async token=>{
      try {
        const {payload}=await jwtVerify(token,jwks,{algorithms:["RS256"],issuer:config.team,
          audience:config.audience,requiredClaims:["exp","iat","email"],clockTolerance:5});
        return typeof payload.email==="string" && config.grants.has(payload.email.toLowerCase());
      } catch {return false;}
    },
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
      "Access-Control-Allow-Headers":"Accept",
      "Vary":"Origin"}:{};
    let result;
    try {
      result=await handler({method:req.method,path:new URL(req.url||"/","https://local.invalid").pathname,
        origin,token:req.headers["cf-access-jwt-assertion"]});
    } catch {result=fail(503,"Development research unavailable");}
    res.writeHead(result.status,{...HEADERS,...cors});
    res.end(result.body===null?"":JSON.stringify(result.body));
  });
  server.listen(port,"0.0.0.0");
  console.log("CYPH/1 development growth read-only API started");
  process.once("SIGTERM",()=>server.close(()=>void pool.end()));
}

if (process.argv[1] && new URL(import.meta.url).pathname===process.argv[1]) {
  run().catch(()=>{console.error("Development Growth API startup failed; check restricted role, Access and origin configuration.");process.exitCode=1;});
}
