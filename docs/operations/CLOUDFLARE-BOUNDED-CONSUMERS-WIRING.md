# Bounded commerce real consumer integration (non-deployed)

Existing commerce code is imported, not reimplemented: the real `TransactionalCommunicationConsumer`, `PostgresCommunicationRepository`, `BrevoCommunicationProvider`, `PostgresFulfilmentOutboxConsumer`, `PostgresFulfilmentRepository`, `FulfilmentService`, and `ManualLiveFulfilmentProvider`.

The adapter `runIntegratedBoundedOnce` creates a Hyperdrive-backed `pg.Pool` (max 2 connections), verifies database identity, then invokes the existing bounded runner. Each selected consumer runs **at most once per invocation**. The pool is closed in a `finally` block, including error/mismatch paths. Current retries, claim fencing, manual review and idempotency remain in the unchanged repositories/consumers.

**Critical: This module is not called by the deployed Worker entrypoint.** It is integration preparation only: no scheduled triggers, no new Hyperdrive binding, no deployment, no production flags changed. Before wiring it to any scheduled entrypoint, review existing provider timeout/uncertain-send handling, CPU and DB timeouts, Hyperdrive TLS, environment configuration, safeguards against scheduling overlapping invocations, and actual launch/safety approvals.

The extra `COMMERCE_BOUNDED_INTEGRATION_ENABLED` requires a further explicit approval. Other required gates: `COMMERCE_BOUNDED_WORKER_ENABLED`, `COMMERCE_BOUNDED_OWNER_AUTHORIZED`, `COMMERCE_LAUNCH_SAFETY_APPROVED`, `COMMERCE_ENABLED`, `NODE_ENV=production`, and the individual communications/fulfilment enablements. Only live Brevo or manual-live fulfilment allowed; no test provider fallback.

This PR must **not** be used to conclude CYPH/1 K-803 is compliant or launch-ready. Product-safety evidence and final GO/NO-GO remain outstanding.
