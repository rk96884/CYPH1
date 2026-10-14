/**
 * CYPH/1 scheduled commerce prototype. Intentionally contains NO integration code.
 * Enabling processing requires a separate implementation and launch approval.
 */
export const scheduled = async (_event, env) => {
  if (env?.COMMERCE_CRON_ENABLED !== "true") {
    return { status: "disabled" };
  }
  // Fail closed even if someone mistakenly changes the flag in Cloudflare.
  throw new Error("Cloudflare commerce processing has not been implemented or approved.");
};

export default {
  scheduled,
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
