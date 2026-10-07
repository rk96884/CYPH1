import pg from "pg";
import { loadCommerceConfig } from "../config.js";
import { loadCommunicationConfig } from "../communications/config.js";
import { BrevoCommunicationProvider } from "../communications/brevo.js";
import { ManualTestCommunicationProvider } from "../communications/manual-test.js";
import { PostgresCommunicationRepository } from "../communications/postgres.js";
import { TransactionalCommunicationConsumer } from "../communications/service.js";
import { PostgresFulfilmentOutboxConsumer } from "../fulfilment/outbox.js";
import { FulfilmentService } from "../fulfilment/service.js";
import { PostgresFulfilmentRepository } from "../fulfilment/postgres.js";
import { ManualLiveFulfilmentProvider } from "../fulfilment/manual-live.js";
import { ManualTestFulfilmentProvider } from "../fulfilment/manual-test.js";
import { databaseConfiguration } from "./database.js";
import { runCommerceWorker, workerEnabled, type WorkerTask } from "./worker.js";
async function main() {
const env = process.env;
if (workerEnabled(env.COMMERCE_WORKER_ENABLED)) {
  const commerce = loadCommerceConfig(env), communications = loadCommunicationConfig(env);
  if (env.NODE_ENV === "production" && commerce.fulfilmentProvider === "manual-test") throw new Error("Production worker cannot use manual-test fulfilment.");
  const fulfilmentEnabled = commerce.fulfilmentMode !== "disabled" && commerce.fulfilmentProvider !== "disabled";
  if (!fulfilmentEnabled && !communications.enabled) throw new Error("Worker requires an explicitly enabled consumer.");
  const pool = new pg.Pool(databaseConfiguration(env));
  pool.on("error", () => console.error(JSON.stringify({ event: "commerce_worker_database_unavailable" })));
  const stop = new AbortController();
  const shutdown = () => { stop.abort(); };
  process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
  const tasks: WorkerTask[] = [];
  if (fulfilmentEnabled) {
    const provider = commerce.fulfilmentProvider === "manual-live" ? new ManualLiveFulfilmentProvider() : new ManualTestFulfilmentProvider();
    const service = new FulfilmentService(true, provider, new PostgresFulfilmentRepository(pool));
    const consumer = new PostgresFulfilmentOutboxConsumer(pool, service);
    tasks.push({ name: "fulfilment", run: () => consumer.runOnce() });
  }
  if (communications.enabled) {
    const provider = (() => {
      if (communications.provider === "manual-test") return new ManualTestCommunicationProvider();
      if (communications.provider === "brevo" && communications.brevo) return new BrevoCommunicationProvider(communications.brevo);
      throw new Error("No approved communication provider is configured.");
    })();
    const consumer = new TransactionalCommunicationConsumer(true, new PostgresCommunicationRepository(pool), provider);
    tasks.push({ name: "communications", run: () => consumer.consumeOne() });
  }
  try {
    await pool.query("SELECT 1");
    await runCommerceWorker(tasks, stop.signal, value => console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...value })));
  } finally {
    stop.abort(); process.removeListener("SIGTERM", shutdown); process.removeListener("SIGINT", shutdown); await pool.end();
  }
}

}
void main().catch(() => {
  console.error(JSON.stringify({ event: "commerce_worker_startup_or_runtime_failed" }));
  process.exitCode = 1;
});
