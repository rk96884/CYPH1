import pg from "pg";

/** Read-only production identity probe. No customer/order table access. */
export async function verifyProductionHyperdrive(env, openPool = config => new pg.Pool(config)) {
  if (env?.PRODUCTION_HYPERDRIVE_READONLY_PROBE !== "true") return {status:"disabled"};
  if (!env?.HYPERDRIVE?.connectionString) return {status:"missing_binding"};
  const pool = openPool({connectionString:env.HYPERDRIVE.connectionString,max:1,connectionTimeoutMillis:3000,query_timeout:3000,idleTimeoutMillis:1000});
  try {
    const r=await pool.query("SELECT current_database() AS database_name, current_user AS role_name");
    if(r.rows.length!==1 || r.rows[0].database_name!=="cyph1_commerce_production" || r.rows[0].role_name!=="cyph1_hyperdrive_prod_worker") return {status:"identity_mismatch"};
    return {status:"verified"};
  } finally { await pool.end(); }
}
export default {
  async fetch(){return new Response("Not found",{status:404});},
  async scheduled(event,env){
    if(event?.cron!=="__manual_production_hyperdrive_readonly__") return;
    let status="failed";
    try {status=(await verifyProductionHyperdrive(env)).status;} catch {/* deliberately suppress credential-bearing errors */}
    console.log(JSON.stringify({event:"production_hyperdrive_readonly",status}));
  }
};
