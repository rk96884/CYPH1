import pg from "pg";

const TABLE = "cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs";

/** One manually requested staging-only test; rolled back with no persisted changes. */
export async function runTransactionProbe(env, openPool = cfg => new pg.Pool(cfg)) {
  if (env?.HYPERDRIVE_TRANSACTION_PROBE_ENABLED !== "true") return { status: "disabled" };
  if (!env?.HYPERDRIVE?.connectionString) throw new Error("Development Hyperdrive binding missing");
  const pool = openPool({ connectionString: env.HYPERDRIVE.connectionString, max: 2, connectionTimeoutMillis: 3000, query_timeout: 4000 });
  let a, b;
  const started = Date.now();
  try {
    a = await pool.connect();
    b = await pool.connect();
    const identity = await a.query("SELECT current_database() AS database_name");
    if (identity.rows[0]?.database_name !== "cyph1_commerce_development") throw new Error("REFUSED: wrong database");
    await a.query("BEGIN");
    await b.query("BEGIN");
    const first = await a.query(`SELECT id FROM ${TABLE} WHERE status = $1 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`, ["pending"]);
    if (first.rows.length !== 1) return { status: "no_seed_rows" };
    const lockedId = first.rows[0].id;
    const second = await b.query(`SELECT id FROM ${TABLE} WHERE status = $1 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`, ["pending"]);
    if (second.rows.some(row => String(row.id) === String(lockedId))) throw new Error("FAILED: SKIP LOCKED duplicated a claim");
    // Prove a rollback discards a tentative update, with no permanent writes.
    await a.query(`UPDATE ${TABLE} SET status = $1 WHERE id = $2`, ["claimed", lockedId]);
    await a.query("ROLLBACK");
    const restored = await b.query(`SELECT status FROM ${TABLE} WHERE id = $1`, [lockedId]);
    if (restored.rows[0]?.status !== "pending") throw new Error("FAILED: rollback did not restore pending job");
    return { status: "verified", locked: true, rolledBack: true, durationMs: Date.now() - started };
  } finally {
    if (a) { try { await a.query("ROLLBACK"); } finally { a.release(); } }
    if (b) { try { await b.query("ROLLBACK"); } finally { b.release(); } }
    await pool.end();
  }
}
