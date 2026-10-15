# CYPH/1 bounded Cloudflare consumer safeguards review

**No execution authorized by this document or PR.** Production commerce, payments, fulfilment and communications remain disabled. The integrated adapter remains **unreferenced by the Worker scheduled entrypoint**; no Cron trigger or Hyperdrive production binding is introduced.

## Connection and TLS safeguards
- The adapter now requires explicit `COMMERCE_HYPERDRIVE_TLS_REVIEWED=true` in addition to the previous owner, launch safety, commerce, integration, and per-consumer approvals. This is a **human-review flag**, not cryptographic evidence of TLS. Review the Cloudflare Hyperdrive origin's encrypted connection configuration and Render certificate verification before enabling. Hyperdrive-to-origin TLS is separate from Worker-to-Hyperdrive connection handling.
- Before claiming any work, the adapter checks both `current_database()` (expected `cyph1_commerce_production`) **and `current_user`** (expected `COMMERCE_DB_ROLE`). Mismatch returns a sanitized result without processing jobs.
- Pool maximum 2, connection timeout 3s, query/statement timeout 10s, lock timeout 2s, short idle timeout. Pool always ends in a `finally` block after creation. Timeouts lower contention but **do not guarantee** an end-to-end 10ms CPU budget or deadline across multiple database queries and Brevo operations.

## Overlapping invocations
- `PostgresCommunicationRepository.claimNext` uses database row-level `FOR UPDATE ... SKIP LOCKED`, a committed claim token, and **claim-token-fenced** `beginSend`, `markSent`, `markFailed`, and `markReview` operations. Claimed sends can move to manual review after an ambiguous send. The durable deduplication key has a conflict-protected INSERT.
- `PostgresFulfilmentOutboxConsumer.claim` also uses `FOR UPDATE SKIP LOCKED` and attempt limits / claim lease for events. `FulfilmentService` reserves using an idempotency key. However, fulfilment `finish` fences by status only, **not** a claim token; concurrent worker crash/retry and provider-side effects require closer integration tests before enabling overlapping scheduled executions.
- Consequently, **do not enable Cron, overlapping invocation or a live payment outbox consumer yet**. This PR adds defensive environment and DB checks but does not establish exact-once side effects. A separate overlap/idempotency test is a pre-launch blocker, not an assumed pass.

## Failure recovery
- Communications: an uncertain or accepted Brevo send is moved to `manual_review`; claims use retry ceilings and stale leases. Never automatically retry an ambiguous external send. A hard termination between a provider acceptance and DB acknowledgement is inherently uncertain; maintain operator review.
- Fulfilment: `runOnce` claims one payment event, attempts reservation/creation, then marks the outbox event published or failed. Retry eligibility must be verified across lease expiry, transient connection failures and process termination to avoid duplicate external effects.
- The bounded runner executes at most one item per selected consumer, sequentially, and sanitizes exception messages. Tests now cover DB identity, role validation, TLS gate, cleanup and bounded pool settings.

## Before any production enablement
1. Verify K-803 eye/skin-specific standards and complete final owner safety GO/NO-GO.
2. Confirm TLS origin setup and least-privilege production role.
3. Add crash/overlap tests with a nonproduction commerce schema, including Brevo timeout/manual-review and fulfilment outbox leasing; fix any observed issues.
4. Establish CPU per invocation and timeouts for actual Hyperdrive/consumer workload. CPU account totals do not prove the 10ms per-invocation Free plan allowance.
5. Obtain **separate** explicit consent before wiring entrypoint, deploying a Worker, scheduling Cron, or changing any live commerce flags.
