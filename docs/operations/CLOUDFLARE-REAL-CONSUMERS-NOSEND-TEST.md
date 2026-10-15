# Real commerce consumer Cloudflare compatibility — no-send test

This test references the **actual compiled commerce implementation**, not a rewritten mock of the business logic. Wrangler dry-run bundles the current `TransactionalCommunicationConsumer`, `PostgresCommunicationRepository`, `BrevoCommunicationProvider`, `PostgresFulfilmentOutboxConsumer`, `FulfilmentService` and `ManualLiveFulfilmentProvider` for Workers. They are imported but never instantiated or executed by a Worker handler.

A Node CI test exercises the actual `TransactionalCommunicationConsumer.consumeOne()` against an **in-memory synthetic fake repository and fake provider**; no Brevo request or PostgreSQL query is possible. It also confirms the actual fulfilment service refuses requests when disabled. The test reports Node CPU usage as a rough baseline, **not** Cloudflare Workers CPU time; it cannot establish the 10ms free Workers per-invocation CPU budget.

## Run in CI / locally
```shell
npm run build:runtime --workspace @cyph1/commerce-api
node --test prototypes/cloudflare-commerce-cron/actual-consumers.test.mjs
npx wrangler@4.45.0 deploy --dry-run --config prototypes/cloudflare-commerce-cron/wrangler.actual-consumers-build.toml
```

**No deployment, schedule, Hyperdrive connection, live communications, payment, email, fulfilment or shipping action.** Later, separately approved tests must assess the actual consumer database transactions and provider adapters with realistic synthetic workloads and real Cloudflare CPU measurement before any production decision.
