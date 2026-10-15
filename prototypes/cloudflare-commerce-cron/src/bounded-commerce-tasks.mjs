import pg from "pg";
import { TransactionalCommunicationConsumer } from "../../../build/commerce-api/apps/commerce-api/src/communications/service.js";
import { PostgresCommunicationRepository } from "../../../build/commerce-api/apps/commerce-api/src/communications/postgres.js";
import { BrevoCommunicationProvider } from "../../../build/commerce-api/apps/commerce-api/src/communications/brevo.js";
import { PostgresFulfilmentOutboxConsumer } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/outbox.js";
import { PostgresFulfilmentRepository } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/postgres.js";
import { FulfilmentService } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/service.js";
import { ManualLiveFulfilmentProvider } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/manual-live.js";
import { loadCommunicationConfig } from "../../../build/commerce-api/apps/commerce-api/src/communications/config.js";
import { loadCommerceConfig } from "../../../build/commerce-api/apps/commerce-api/src/config.js";
import { runBoundedCommerceOnce } from "./bounded-commerce-runner.mjs";

export const approvedForBoundedRun = env =>
  env?.COMMERCE_BOUNDED_WORKER_ENABLED === "true" &&
  env?.COMMERCE_BOUNDED_OWNER_AUTHORIZED === "true" &&
  env?.COMMERCE_LAUNCH_SAFETY_APPROVED === "true" &&
  env?.COMMERCE_BOUNDED_INTEGRATION_ENABLED === "true" &&
  (env?.COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED === "true" || env?.COMMERCE_BOUNDED_FULFILMENT_ENABLED === "true");

/**
 * Production wiring for existing consumers. All enablement requires separate
 * owner authorization and final product-safety launch approval. No fallback
 * to test providers in this adapter.
 *
 * Inject a pool factory only for tests. Do not log env or exceptions.
 */
export async function runIntegratedBoundedOnce(env, makePool = cfg => new pg.Pool(cfg)) {
  if (!approvedForBoundedRun(env)) return {status:"disabled",results:[]};
  const wantsEmail = env.COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED === "true";
  const wantsFulfilment = env.COMMERCE_BOUNDED_FULFILMENT_ENABLED === "true";
  if (env.COMMERCE_ENABLED !== "true" || env.NODE_ENV !== "production") return {status:"disabled",results:[]};
  if (!env.HYPERDRIVE?.connectionString) return {status:"disabled",results:[]};
  const commerce = loadCommerceConfig(env);
  const communications = loadCommunicationConfig(env);
  if (!commerce.commerceEnabled) return {status:"disabled",results:[]};
  if (wantsEmail && (communications.provider !== "brevo" || !communications.enabled || !communications.brevo)) return {status:"disabled",results:[]};
  if (wantsFulfilment && (commerce.fulfilmentMode !== "live" || commerce.fulfilmentProvider !== "manual-live")) return {status:"disabled",results:[]};
  // Hyperdrive manages upstream TLS; no URL is written to logs.
  const pool = makePool({connectionString:env.HYPERDRIVE.connectionString,max:2,connectionTimeoutMillis:3000,query_timeout:10000,statement_timeout:10000,idleTimeoutMillis:1000});
  try {
    // Identity must be checked before ANY consumer claims or sends.
    const identity = await pool.query("SELECT current_database() AS database_name");
    if (identity.rows[0]?.database_name !== "cyph1_commerce_production") return {status:"database_mismatch",results:[]};
    const tasks={};
    if (wantsEmail) {
      const provider = new BrevoCommunicationProvider(communications.brevo);
      const consumer = new TransactionalCommunicationConsumer(true,new PostgresCommunicationRepository(pool),provider);
      tasks.communications = () => consumer.consumeOne();
    }
    if (wantsFulfilment) {
      const service = new FulfilmentService(true,new ManualLiveFulfilmentProvider(),new PostgresFulfilmentRepository(pool));
      const consumer = new PostgresFulfilmentOutboxConsumer(pool,service);
      tasks.fulfilment = () => consumer.runOnce();
    }
    return await runBoundedCommerceOnce(env,tasks);
  } finally {
    await pool.end();
  }
}
