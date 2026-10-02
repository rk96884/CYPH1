# Merchandise returns Phase 1 — staging verification

**Status:** PASSED / Phase 1 staging verification complete  
**Date:** 2 October 2026  
**Scope:** Backend/domain foundation and protected Operations API only. Phase 2 Operations UI and return-driven refund workflow remain separate work.

## Deployment and schema evidence

Phase 1 was rolled out schema-first to the Render staging commerce database.

- `0015_merchandise_returns.sql` applied successfully.
- A second migration run reported the database schema up to date at **15 migrations**.
- `npm run db:verify --workspace @cyph1/commerce-api` verified **25 required tables** and passed the merchandise-return constraints, including controlled category, non-negative decision, explicit receipt waiver, separate inspection after receipt, and closure requiring a decision.
- Schema verification rolled back its test records.
- Operations staging was deployed only after the schema migration succeeded; Customer staging was deployed after the Operations smoke test.
- Existing Operations order search/detail functionality was manually smoke-tested successfully after deployment.

### Migration-history repair encountered during rollout

The migration runner initially stopped because staging recorded a different checksum for previously applied `0013_capture_command_reconciliation.sql` than the canonical committed file. The repository copy was clean and Git history showed no later edit. Read-only staging inspection confirmed all six expected `operator_commands` columns, the `capture_payment_id -> payments.id` foreign key, and a zero-count missing-backfill invariant. The historical staging checksum had been recorded before the final migration commit. A one-use guarded transaction updated only that exact previously observed checksum to the canonical committed SHA-256; the subsequent migration run then applied `0015` normally. No migration SQL or application data was altered as part of that repair.

## Render internal PostgreSQL TLS finding

The first newly deployed Operations runtime returned HTTP 500 on an existing-order smoke test with `self-signed certificate` from PostgreSQL TLS verification. Investigation confirmed Phase 1 had not changed `pg`, connection-string handling or TLS construction. The staging service was using Render's internal PostgreSQL endpoint with `DATABASE_SSL=true`, while the repository's existing staging documentation specifies `DATABASE_SSL=false` for that internal connection. Restoring `DATABASE_SSL=false` and restarting Operations restored database-backed order search immediately.

Customer and Operations runtime configuration should remain consistent with the documented Render internal-connection trust model. Do not use global `NODE_TLS_REJECT_UNAUTHORIZED=0`. A follow-up engineering improvement is to make deployment readiness/smoke verification exercise a database-backed operation rather than relying only on a health endpoint that can remain green when PostgreSQL connectivity is broken.

## Authorization evidence

The protected returns read endpoint initially passed while return creation returned HTTP 403. This confirmed Cloudflare Access authentication and `orders:read` were effective but the running operator grant lacked `returns:manage`.

The existing `OPERATIONS_ACCESS_GRANTS` entry was extended with only `returns:manage`; `returns:approve` was not added for this test. After Operations restart, an intentionally invalid create request using an all-zero order UUID and empty body returned the expected controlled HTTP 400 `invalid_request` response (`A controlled return value is required.`), proving authentication and `returns:manage` authorization had succeeded before validation. The probe could not create a record.

## Synthetic staging lifecycle verification

The verification used the existing synthetic order:

- Order: `CYPH-T-4FFB876A8A9A`
- Order UUID: `4ffb876a-8a9a-4003-a2a8-f98b3963787c`
- Item UUID: `dcffdd62-7385-4128-b249-4b52a8879fa7`
- Item: `INTEGRATION TEST FIXTURE — NOT FOR SALE`
- Baseline order state: `paid`
- Baseline fulfilment state: `unfulfilled`
- Baseline refunds: none
- Baseline merchandise returns: none

The deliberately short lifecycle was **`requested -> cancelled`** so staging could exercise the return domain without approving money, issuing a refund, recording receipt, closing a return, or invoking fulfilment/provider behaviour.

### Result

**PHASE 1 RETURNS STAGING TEST: PASS**

- Created one `customer_choice` return for quantity 1.
- Generated return reference: `RET-05E666A2DD4446AB`.
- Initial return state/version: `requested` / `1`.
- Replaying the identical creation with the same idempotency key returned the original return and did not create a duplicate.
- Cancellation with `expectedVersion: 1` succeeded and produced `cancelled` / version `2` with controlled withdrawal reason.
- A second cancellation attempt using a fresh idempotency key but stale `expectedVersion: 1` returned the expected HTTP **409 Conflict**.
- Final projection retained exactly one cancelled return at version 2.
- Timeline contained exactly one `return.requested` and one `return.cancelled` event; the rejected stale mutation produced no return event.
- Payment state was unchanged from baseline.
- Refund state was unchanged from baseline.
- Fulfilment state was unchanged from baseline.
- No Mollie transaction was initiated by the return lifecycle.
- The cancelled synthetic return is intentionally retained as staging/audit evidence; cancellation releases its return allocation.

The available Operations API does not expose inventory balances, so this manual staging procedure does not independently compare inventory before/after. Phase 1 source/tests establish that these return actions do not perform inventory, fulfilment or provider calls; inventory orchestration remains outside this Phase 1 staging exercise.

## Phase 1 conclusion

The merchandise-returns Phase 1 backend/domain foundation is **staging-verified and complete** for its intended scope. This does not approve production commerce and does not complete the customer/legal/operational returns programme.

Phase 2 remains outstanding and is expected to cover the Operations returns UI and the controlled return-driven refund workflow, with provider association/reconciliation and appropriate staging evidence. Other deferred capabilities include exports, customer self-service, return communications and fulfilment/inventory orchestration unless separately brought into scope.
