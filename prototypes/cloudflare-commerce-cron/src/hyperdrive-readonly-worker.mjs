import pg from "pg";

/** Read-only, single-shot Hyperdrive test. No HTTP routes, cron or commerce consumers. */
export async function runReadOnlyProbe(env, openPool = config => new pg.Pool(config)) {
  if (env?.HYPERDRIVE_PROBE_ENABLED !== "true") return Object.freeze({ status: "disabled" });
  if (!env?.HYPERDRIVE?.connectionString) throw new Error("Non-production Hyperdrive binding missing");
  const pool = openPool({
    connectionString: env.HYPERDRIVE.connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 1000,
    query_timeout: 3000,
  });
  try {
    const result = await pool.query(
      "SELECT current_database() AS database_name, (SELECT count(*)::int FROM cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs) AS job_count"
    );
    if (result.rows.length !== 1 || result.rows[0].database_name !== "cyph1_commerce_development") {
      throw new Error("REFUSED: probe not connected to the approved development database");
    }
    return Object.freeze({ status: "verified", jobCount: result.rows[0].job_count });
  } finally {
    await pool.end();
  }
}

export default {
  async fetch() { return new Response("Not found", { status: 404 }); },
  async scheduled() { return; },
};
