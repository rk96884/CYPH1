# CYPH/1 private commerce operations

**Status:** Milestone 3.2 test baseline. No production commerce or live payment capability is approved by this document.

## Security boundary

The operations handler accepts an `OperationsPrincipal` only from trusted authentication middleware. The browser must never supply an operator ID or permission list directly. Protect the console and API with the same upstream identity control, verify that identity in the API runtime, and map it to the minimum required permissions:

- `orders:read`
- `refunds:create`
- `fulfilment:retry`
- `reconciliation:export`

The API deliberately emits no permissive CORS headers. Deploy the console and operations endpoint behind one protected origin or a same-origin reverse proxy. The compile-time presentation flag and obscure slug are not security controls.

## Private console

Normal builds omit the route. A protected test deployment may set:

```text
PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED=true
PUBLIC_COMMERCE_OPERATIONS_SLUG=an-unpublished-test-slug
PUBLIC_COMMERCE_OPERATIONS_API_URL=https://protected-test-origin.example
```

The route is `/private-operations/<slug>/`, carries `noindex`, and is excluded from the sitemap. Do not set these values on the public pre-launch deployment.

## Supported workflows

- Search recent orders by order number and inspect their audit timeline, payments, refunds and fulfilments.
- Submit a partial or full refund using an approved reason and unique idempotency key. The API rechecks the provider's authoritative refundable balance.
- Requeue only a failed `payment.paid` outbox event. Reprocessing uses the original fulfilment/provider idempotency key.
- Export up to 5,000 reconciliation rows over no more than 31 days. The export
  includes every payment attempt plus checkout and refund exception totals for
  orders, payments or refunds active in the selected interval. It excludes
  customer/address data and neutralises spreadsheet formula prefixes.

Every mutation records the operator, correlation ID and a non-sensitive summary in `audit_events`. Durable `operator_commands` reject idempotency-key reuse with different request content.

## Operational rules

### Phase 1 merchandise returns backend

Migration `0015_merchandise_returns.sql` adds `returns`, `return_items` and a
nullable `refunds.return_id`. Historical refunds remain unlinked. Merchandise
returns are distinct from refunds, fulfilment cancellation/return commands and
payment disputes. This backend is not staging-verified or launch-approved.

- `GET /operations/orders/:orderId/returns` requires `orders:read`.
- `POST /operations/orders/:orderId/returns` requires `returns:manage`, a valid
  `Idempotency-Key`, a controlled `category` and `items` containing
  `orderItemId`/integer `quantity`.
- `POST /operations/orders/:orderId/returns/:returnId/:action` requires a valid
  `Idempotency-Key` and `expectedVersion`. `receive`, `inspect` and requested-case
  `cancel` require `returns:manage`; `approve`, `reject` and `close` require
  `returns:approve`. Neither permission grants `refunds:create`.
- Approval supplies an explicit `approvedRefundMinor` (including zero),
  `receiptRequired`, all item quantities and, when waived, `receiptWaiverReason`
  (`receipt_not_required` or `operator_waiver`). No amount is calculated from
  product prices, tax, shipping or legal eligibility. Approval cannot be silently
  overwritten.
- Receipt supplies cumulative quantities for all items, within approval.
  Inspection is a separate immutable `outcome` recorded after complete receipt:
  `no_issue_observed`, `issue_observed`, `inconclusive` or `not_applicable`.
  Rejection uses `not_approved`/`duplicate_request`; cancellation uses
  `request_withdrawn`/`duplicate_request`. Categories such as `fault_reported`
  record customer reports, not factual findings or entitlements.
- The lifecycle is `requested → approved → received → closed`, with terminal
  `rejected`/`cancelled` alternatives from `requested`. An explicit receipt waiver
  permits `approved → closed`. Closure requires the monetary decision to be
  satisfied by linked completed refunds, or an explicit zero decision, and no
  unresolved order refund. Positive unpaid obligations cannot close in Phase 1.
- Transactions serialize allocation per order; requested quantities reserve
  units, approval reduces this to approved quantities, and rejection/cancellation
  release the reservation. Closed merchandise cases retain their unit allocation.
  Composite foreign keys prevent cross-order item association. Mutations fence
  versions, persist idempotent commands and emit minimised `return.*` audit events.
- Order details now expose item ID/SKU/name snapshots and purchased quantity for
  future selection. Returns are read through the protected returns route; the
  existing order timeline includes their events. Return references are identifiers
  only and do not grant access.

No Operations UI, provider calls, refund initiation, automatic restocking,
fulfilment orchestration, customer portal, exports or return emails are added.
The [Phase 2 decision UI](MERCHANDISE-RETURNS-PHASE-2.md) adds approval/rejection
controls only; it does not initiate money movement. A future return-driven
refund increment must link a refund inside the existing reservation transaction before
provider contact, enforce `returns:approve` **and** `refunds:create`, and check
unresolved refunds server-side. The existing global refund path is unchanged.

Local verification: `npm run db:rehearse:returns --workspace @cyph1/commerce-api`
requires `RETURNS_TEST_DATABASE_URL` to name a migrated disposable local
`*_returns_test` database. It uses synthetic records and real PostgreSQL lock
contention without contacting a provider. Schema/restore inventories include
both new tables. Application rollback must preserve these records and links;
disable new actions rather than dropping the schema or outstanding obligations.

The rehearsal is local-only and must never run against staging or production.
Connection URL query parameters are rejected before connection, including host
overrides. Closure checks payment ownership for every linked refund and rejects
wrong-order relationships rather than ignoring them. Closure also refuses any
order refund in `created`, `pending` or `resolution_required`.

For closure only, a transaction takes `LOCK TABLE refunds IN SHARE MODE NOWAIT`
before locking the order with `FOR UPDATE NOWAIT`, then the return. Active refund
writes or a busy order cause a controlled
conflict immediately; new writes wait until the short closure transaction ends.
This table-wide fence briefly affects refunds across all orders, requires no
provider contact and avoids waiting on refund locks while holding an order lock.
Existing refund transactions and provider behaviour are unchanged. Ordinary
return reads use one statement snapshot without locking.

Staging deployment must be schema-first: back up the staging database, apply
`0015_merchandise_returns.sql` with the checksum-aware migration runner, rerun
the runner and verify all 25 required tables before deploying the new runtime.
The new order timeline queries `returns` even for orders without return records;
deploying it before migration breaks order-detail requests. A `SELECT 1` health
check does not prove this schema dependency is satisfied. The old application
remains compatible with the additive schema. Application rollback should retain
migration 0015 and its records, not attempt a destructive schema rollback.

### Existing operational rules

1. Confirm the order, captured payment, refund reason and amount before acting.
2. Never retry an event while another operator is investigating it.
3. Treat a provider `pending` refund as incomplete until reconciled.
4. Investigate a failed command rather than creating repeated new keys.
5. Store exports only in an approved restricted location.
6. Keep commerce and fulfilment disabled outside the protected test runtime.

## Migration and verification

Migration `0006_operator_commands.sql` adds the durable command ledger and failed-outbox lookup index. Apply all current migrations through the checksum-aware migration runner, then verify 25 required tables:

```powershell
npm run db:migrate
npm run db:migrate
npm run db:verify
```

The second migration must report that the schema is up to date. Verification rolls all test records back.
