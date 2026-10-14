/**
 * Build-only Cloudflare compatibility probe. No connections, no credentials.
 * Never deploy. This deliberately does not import the commerce repositories:
 * no end-to-end consumer runtime compatibility is implied.
 */
import pg from "pg";
import { scheduled as disabledSchedule } from "./worker.mjs";

export const driverVersionContract = () => ({
  pool: typeof pg.Pool === "function",
  client: typeof pg.Client === "function",
});

export default {
  async scheduled(event, env) {
    // Strictly keep the prototype disabled; no SQL or remote calls.
    return disabledSchedule(event, env);
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
