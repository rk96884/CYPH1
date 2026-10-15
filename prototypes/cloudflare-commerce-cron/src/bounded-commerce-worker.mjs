import { runBoundedCommerceOnce } from "./bounded-commerce-runner.mjs";

/**
 * Production-adjacent integration shell. No live task providers are wired.
 * A future reviewed change must explicitly supply consumers (with Hyperdrive
 * and existing repositories) following launch/safety authorization.
 */
export default {
  async scheduled(_event, env) {
    const result = await runBoundedCommerceOnce(env);
    console.log(JSON.stringify({event:"bounded_commerce_worker",...result}));
  },
  async fetch() { return new Response("Not found",{status:404}); },
};
