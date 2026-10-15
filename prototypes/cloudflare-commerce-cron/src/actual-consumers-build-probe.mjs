/**
 * Cloudflare bundle-only compatibility of EXISTING commerce modules.
 * No instances, database clients, HTTP providers, Cron, or handlers that execute.
 * Requires `npm run build:runtime --workspace @cyph1/commerce-api` first.
 */
import { TransactionalCommunicationConsumer } from "../../../build/commerce-api/apps/commerce-api/src/communications/service.js";
import { PostgresCommunicationRepository } from "../../../build/commerce-api/apps/commerce-api/src/communications/postgres.js";
import { BrevoCommunicationProvider } from "../../../build/commerce-api/apps/commerce-api/src/communications/brevo.js";
import { PostgresFulfilmentOutboxConsumer } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/outbox.js";
import { FulfilmentService } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/service.js";
import { ManualLiveFulfilmentProvider } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/manual-live.js";

export const importedContracts = () => [
  TransactionalCommunicationConsumer, PostgresCommunicationRepository, BrevoCommunicationProvider,
  PostgresFulfilmentOutboxConsumer, FulfilmentService, ManualLiveFulfilmentProvider,
].every(value => typeof value === "function");

export default {
  async fetch() { return new Response("Not found", { status: 404 }); },
  async scheduled() { /* no-op: never runs consumers */ },
};
