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
- Export up to 5,000 reconciliation rows over no more than 31 days. The export excludes customer/address data and neutralises spreadsheet formula prefixes.

Every mutation records the operator, correlation ID and a non-sensitive summary in `audit_events`. Durable `operator_commands` reject idempotency-key reuse with different request content.

## Operational rules

1. Confirm the order, captured payment, refund reason and amount before acting.
2. Never retry an event while another operator is investigating it.
3. Treat a provider `pending` refund as incomplete until reconciled.
4. Investigate a failed command rather than creating repeated new keys.
5. Store exports only in an approved restricted location.
6. Keep commerce and fulfilment disabled outside the protected test runtime.

## Migration and verification

Migration `0006_operator_commands.sql` adds the durable command ledger and failed-outbox lookup index. Apply it through the checksum-aware migration runner, then verify 22 required tables:

```powershell
npm run db:migrate
npm run db:migrate
npm run db:verify
```

The second migration must report that the schema is up to date. Verification rolls all test records back.
