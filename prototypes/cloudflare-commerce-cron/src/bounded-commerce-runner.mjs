/**
 * One invocation handles AT MOST one item per enabled consumer. No polling,
 * no timers, no scheduling. Consumers retain their own durable claim, fencing,
 * retry and manual-review behaviour.
 *
 * The runner has no connection string, provider or database imports; live
 * wiring is deliberately separate from scheduling and launch authorization.
 */
const outcomes = new Set(["processed","idle","failed","sent","empty","disabled","manual_review"]);
export async function runBoundedCommerceOnce(env, tasks = {}) {
  if (env?.COMMERCE_BOUNDED_WORKER_ENABLED !== "true") return { status:"disabled", results:[] };
  if (env?.COMMERCE_BOUNDED_OWNER_AUTHORIZED !== "true") return { status:"disabled", results:[] };
  // Hard stop until launch safety evidence and final GO/NO-GO are signed off.
  if (env?.COMMERCE_LAUNCH_SAFETY_APPROVED !== "true") return { status:"disabled", results:[] };
  const selected = [];
  if (env?.COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED === "true") selected.push(["communications",tasks.communications]);
  if (env?.COMMERCE_BOUNDED_FULFILMENT_ENABLED === "true") selected.push(["fulfilment",tasks.fulfilment]);
  if (!selected.length) return { status:"disabled", results:[] };
  // No parallel consumer invocations: serial execution lowers DB pressure.
  const results = [];
  for (const [name, run] of selected) {
    if (typeof run !== "function") throw new Error("Missing enabled consumer implementation");
    let outcome = "failed";
    try {
      const response = await run();
      const candidate = typeof response === "string" ? response : response?.outcome;
      outcome = outcomes.has(candidate) ? candidate : "failed";
    } catch {
      // Never log provider error objects or personal customer information.
      outcome = "failed";
    }
    results.push({ consumer:name, outcome });
  }
  return { status:"completed", results };
}
