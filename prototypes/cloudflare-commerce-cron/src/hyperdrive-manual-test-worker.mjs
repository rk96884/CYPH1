import { runReadOnlyProbe } from "./hyperdrive-readonly-worker.mjs";
import { runTransactionProbe } from "./hyperdrive-transaction-probe.mjs";

/**
 * Explicit scheduled-event invocation only. No cron is registered in the config.
 * Do not deploy/trigger until approved. Never expose a database probe over HTTP.
 */
export async function manualTestScheduled(event, env, ctx, probe = runReadOnlyProbe) {
  if (env?.HYPERDRIVE_PROBE_ENABLED !== "true") return { status: "disabled" };
  if (event?.cron !== "__manual_hyperdrive_test__") {
    return { status: "not_manual_test" };
  }
  return probe(env);
}

export default {
  async scheduled(event, env, ctx) {
    // Avoid recording any connection-string or database credentials in logs.
    const isTransaction = event?.cron === "__manual_hyperdrive_transaction_test__";
    const result = isTransaction
      ? (env?.HYPERDRIVE_TRANSACTION_PROBE_ENABLED === "true" ? await runTransactionProbe(env) : { status: "disabled" })
      : await manualTestScheduled(event, env, ctx);
    // Only non-secret, synthetic-table result metadata; errors stay sanitized.
    console.log(JSON.stringify({ event: isTransaction ? "hyperdrive_transaction_probe" : "hyperdrive_manual_probe", status: result.status, ...(result.status === "verified" && !isTransaction ? { jobCount: result.jobCount } : {}), ...(result.status === "verified" && isTransaction ? { locked: result.locked, rolledBack: result.rolledBack, durationMs: result.durationMs } : {}) }));
  },
  async fetch() { return new Response("Not found", { status: 404 }); },
};
