import { runReadOnlyProbe } from "./hyperdrive-readonly-worker.mjs";

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
    const result = await manualTestScheduled(event, env, ctx);
    // Only non-secret, synthetic-table result metadata; errors stay sanitized.
    console.log(JSON.stringify({ event: "hyperdrive_manual_probe", status: result.status, ...(result.status === "verified" ? { jobCount: result.jobCount } : {}) }));
  },
  async fetch() { return new Response("Not found", { status: 404 }); },
};
