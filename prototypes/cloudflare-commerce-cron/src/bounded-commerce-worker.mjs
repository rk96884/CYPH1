import { runIntegratedBoundedOnce } from "./bounded-commerce-tasks.mjs";

/**
 * Production adapter is wired, but every gate defaults OFF, no cron is
 * configured, and HTTP always returns 404. Do not deploy before approval.
 */
export async function scheduledBoundedCommerce(event, env, execute = runIntegratedBoundedOnce) {
  if (event?.cron !== "__cyph1_bounded_commerce__") return {status:"not_authorized_event",results:[]};
  if (env?.COMMERCE_BOUNDED_WORKER_ENABLED !== "true" ||
      env?.COMMERCE_BOUNDED_OWNER_AUTHORIZED !== "true" ||
      env?.COMMERCE_LAUNCH_SAFETY_APPROVED !== "true" ||
      env?.COMMERCE_BOUNDED_INTEGRATION_ENABLED !== "true") return {status:"disabled",results:[]};
  return execute(env);
}

export default {
  async scheduled(event, env) {
    let result;
    try { result = await scheduledBoundedCommerce(event,env); }
    catch { result = {status:"failed",results:[]}; }
    // Never log DB connection details, provider data, customer PII or exception messages.
    console.log(JSON.stringify({event:"bounded_commerce_worker",...result}));
  },
  async fetch() { return new Response("Not found",{status:404}); },
};
