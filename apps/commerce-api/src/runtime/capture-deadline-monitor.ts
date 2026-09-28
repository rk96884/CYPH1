import pg from "pg";
import { loadCaptureDeadlineConfig } from "../payments/capture-deadline.js";
import { CaptureDeadlineMonitor } from "../payments/capture-monitor.js";
import { PostgresCaptureMonitorRepository } from "../payments/capture-monitor-postgres.js";
import { createPaymentProviderRegistry } from "../payments/factory.js";

async function main(): Promise<void> {
  const config = loadCaptureDeadlineConfig(process.env);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER === "disabled") throw new Error("An enabled PAYMENT_PROVIDER is required.");
  const providers = createPaymentProviderRegistry(process.env);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
    max: 2, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  try {
    const result = await new CaptureDeadlineMonitor(new PostgresCaptureMonitorRepository(pool), providers, config).run();
    console.log(JSON.stringify({ event: "capture_deadline_monitor", ...result }));
    if (result.actionable) process.exitCode = 1;
  } finally { await pool.end(); }
}

void main().catch(() => {
  // Do not expose database URLs, provider responses or credentials in scheduler logs.
  console.error(JSON.stringify({ event: "capture_deadline_monitor_failed", action: "Check server configuration, database connectivity/migration and provider access." }));
  process.exitCode = 2;
});
