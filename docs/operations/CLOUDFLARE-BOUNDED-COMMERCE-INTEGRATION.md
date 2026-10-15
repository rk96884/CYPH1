# Cloudflare bounded commerce Worker (disabled integration shell)

- Replaces the **continuous polling loop** concept with at most **one claim/operation per enabled consumer per invocation**.
- Retains the existing `TransactionalCommunicationConsumer.consumeOne()` and `PostgresFulfilmentOutboxConsumer.runOnce()` contracts, including durable DB claim leases, idempotency, uncertain Brevo delivery -> manual review, and retries. The runner never implements substitute retry logic.
- A future task-wiring change must use the current repositories and providers without bypassing compliance, protection flags or approval. **No live task wiring exists in this change.**
- Fail-closed flags: `COMMERCE_BOUNDED_WORKER_ENABLED`, `COMMERCE_BOUNDED_OWNER_AUTHORIZED`, `COMMERCE_LAUNCH_SAFETY_APPROVED`. All are false by default.
- Fulfilment and communications independently disabled. No Cron, no Hyperdrive binding, no public HTTP route, no live email, no production DB.
- CI unit tests prove tasks run no more than once per invocation, sequentially, and that both owner authorization and safety approval gates are required. Wrangler dry-run checks Workers bundle.
- This is **not ready to schedule or deploy**; worker task assembly, safe Hyperdrive configuration, timeout policy, per-invocation CPU metrics, launch compliance and final GO/NO-GO remain prerequisites. Production checkout/payments/webhooks/fulfilment/emails remain disabled.
