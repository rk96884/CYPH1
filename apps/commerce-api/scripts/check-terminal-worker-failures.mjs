import pg from "pg";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const monitorDatabaseTls = (env) => {
  if (env.DATABASE_SSL !== undefined && !["true","false"].includes(env.DATABASE_SSL)) throw new Error("Invalid DATABASE_SSL.");
  if (env.NODE_ENV === "production" && env.DATABASE_SSL !== "true") throw new Error("Production requires verified database TLS.");
  let url; try { url = new URL(env.DATABASE_URL); } catch { throw new Error("Invalid DATABASE_URL."); }
  if (!["postgres:","postgresql:"].includes(url.protocol)) throw new Error("Invalid DATABASE_URL.");
  if ([...url.searchParams.keys()].some(key => /^ssl/i.test(key))) throw new Error("Configure TLS separately from DATABASE_URL.");
  return env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined;

};

export const terminalFailureSummary = async (pool) => {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM outbox_events
        WHERE aggregate_type='payment' AND event_type='payment.paid'
          AND processing_status='failed' AND (last_error_code='retry_exhausted' OR attempt_count >= 3)) AS fulfilment_count,
      (SELECT count(*)::int FROM communication_deliveries
        WHERE (status='manual_review' OR (status='failed' AND (terminal_failure OR attempt_count >= 3 OR last_error_code='retry_exhausted')))) AS communication_count,
      LEAST(
        (SELECT min(created_at) FROM outbox_events
          WHERE aggregate_type='payment' AND event_type='payment.paid'
            AND processing_status='failed' AND (last_error_code='retry_exhausted' OR attempt_count >= 3)),
        (SELECT min(created_at) FROM communication_deliveries
          WHERE (status='manual_review' OR (status='failed' AND (terminal_failure OR attempt_count >= 3 OR last_error_code='retry_exhausted'))))
      ) AS oldest_created_at
  `);
  const row = result.rows[0];
  return Object.freeze({
    fulfilmentCount: Number(row.fulfilment_count),
    communicationCount: Number(row.communication_count),
    oldestCreatedAt: row.oldest_created_at ? new Date(row.oldest_created_at) : undefined,
  });
};

export const formatTerminalFailureSummary = (summary, now = new Date()) => {
  const lines = [
    `Fulfilment terminal failures: ${summary.fulfilmentCount}`,
    `Communication terminal failures: ${summary.communicationCount}`,
  ];
  if (summary.oldestCreatedAt) {
    const age = Math.max(0, Math.floor((now.getTime() - summary.oldestCreatedAt.getTime()) / 60000));
    lines.push(`Oldest outstanding failure age: ${age} minutes`);
  }
  return lines;
};

const direct = Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (direct) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const ssl = monitorDatabaseTls(process.env);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });
  try {
    const summary = await terminalFailureSummary(pool);
    for (const line of formatTerminalFailureSummary(summary)) console.log(line);
    if (summary.fulfilmentCount > 0 || summary.communicationCount > 0) {
      console.error("Terminal worker failures detected; authorised operational investigation is required.");
      process.exitCode = 1;
    }
  } finally { await pool.end(); }
}
