# Cloudflare bounded commerce: consolidated deployment readiness

This PR **wires** the previously reviewed real consumer adapter into the bounded Worker entrypoint. It does **not** deploy the Worker or add Cron. All approval flags are explicitly false in `wrangler.bounded-commerce.toml`.

## Completed technical preparation
- Production `outbox_events.claim_token` migration confirmed.
- Production Hyperdrive ID `6853d927cd45484390f49a73ff260022` configured, caching disabled and read-only database/role identity probe verified.
- Restricted database role `cyph1_hyperdrive_prod_worker` created; selected grants independently checked.
- Development PostgreSQL transaction locking, SKIP LOCKED, stale-claim fencing and retry exhaustion tested.
- Existing transactional email and fulfilment consumers reused; pool max 2, database identity and role validation, bounded one-per-consumer invocation, try/finally pool cleanup.
- Current entrypoint accepts only the explicit `__cyph1_bounded_commerce__` test marker; unrelated scheduled events cannot invoke it. HTTP always returns 404; no [triggers] configured.

## Before any disabled-only production deployment
1. Require **separate owner approval** for deployment (this PR does not grant it). A deployed but disabled Worker is a new production resource.
2. Resolve the existing Hyperdrive origin certificate-validation/TLS uncertainty. Successful connectivity alone does not prove certificate verification.
3. Confirm the deployed configuration's env flags remain `false` and no secrets are included in source, CI output or Wrangler configuration. Do not add Cron.
4. Independently audit Worker route exposure and permissions (HTTP 404, no public routes); confirm production Hyperdrive origin and identity.
5. Verify no other services have activated checkout, payments, communications, webhooks or fulfilment.

## Before any live processing (separate approval and release)
- Outstanding K-803 eye/skin-specific standards evidence, owner product-safety signoff and final GO/NO-GO. No enabling commerce without these.
- End-to-end crash and retry tests with realistic synthetic payment/fulfilment events; database fencing does not guarantee external exactly-once effects.
- Confirm Brevo ambiguous-send manual review, provider idempotency and failure recovery.
- Measure actual per-invocation Cloudflare CPU against Free plan limit; account-wide usage and wall time cannot establish eligibility.
- Security review of Hyperdrive TLS, DB grants, logging, retention and least privilege.
- Explicit deployment/scheduling plan, rollback procedure and operational alerting. **No Cron can run this marker as a real schedule without changing event routing**, so any future scheduling must be reviewed separately and tested.
- Final separate owner permission before enabling any flags, provider sends or Cron.

## Safe rollback
Current PR changes are Git-only and require no rollback of production. Any future deployed Worker can be disabled by retaining flags false and removing its scheduling/routing. Database schema and role grants are separate controlled changes.

No live email, shipping, payment, checkout or worker execution is performed by this PR.
