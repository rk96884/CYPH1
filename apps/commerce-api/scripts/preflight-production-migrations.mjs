import process from "node:process";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});
const report = [];
let blocked = false;
const note = (status, description, count, detail) => {
  const line = `${status}: ${description} — ${count}${detail ? ` (${detail})` : ""}`;
  console.log(line);
  report.push(line);
  if (status === "BLOCK") blocked = true;
};
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await client.query("SET LOCAL lock_timeout = '3s'");
  const applied = await client.query("SELECT version FROM schema_migrations");
  const done = new Set(applied.rows.map(row => row.version));
  const pending = version => ![...done].some(name => name.startsWith(version + "_"));
  if (pending("0011")) {
    const duplicates = await client.query(`
      SELECT COUNT(*)::integer AS count FROM (
        SELECT target_id FROM operator_commands
        WHERE command_type = 'payment.capture'
        GROUP BY target_id HAVING COUNT(*) > 1
      ) duplicates
    `);
    const count = duplicates.rows[0].count;
    note(count ? "BLOCK" : "PASS", "0011 duplicate payment.capture target_id groups", count);
  } else note("SKIP", "0011 already applied", 0);

  if (pending("0017")) {
    const active = await client.query(`
      SELECT COUNT(*)::integer AS count FROM communication_deliveries
      WHERE status = 'processing'
    `);
    const count = active.rows[0].count;
    note(count ? "REVIEW" : "PASS", "0017 processing communications transitioning to manual_review", count,
      count ? "review before applying; possible provider sends in flight" : "");
  } else note("SKIP", "0017 already applied", 0);

  if (pending("0013")) {
    const legacy = await client.query(`
      SELECT COUNT(*)::integer AS count FROM operator_commands c
      JOIN payments p ON p.order_id = c.target_id
      WHERE c.command_type='payment.capture' AND c.result->>'paymentId'=p.id::text
    `);
    note("INFO", "0013 capture commands eligible for payment binding backfill", legacy.rows[0].count);
  } else note("SKIP", "0013 already applied", 0);

  if (pending("0018") || pending("0019")) {
    const rates = await client.query("SELECT COUNT(*)::integer AS count FROM shipping_rates");
    const orders = await client.query("SELECT COUNT(*)::integer AS count FROM orders");
    note("REVIEW", "0018/0019 immutable shipping revisions", rates.rows[0].count,
      `${orders.rows[0].count} existing orders; review application writes to shipping rates/order shipping evidence`);
  } else note("SKIP", "0018/0019 already applied", 0);

  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    "\n### Read-only production preflight\n\n" + report.map(s => "- " + s + "\n").join("") +
    "\nREVIEW and INFO findings are not automatic approvals. Inspect pending SQL and production recovery readiness before Apply.\n");
}
if (blocked) throw new Error("Production preflight found blocking conflicts. Do not apply migrations.");
