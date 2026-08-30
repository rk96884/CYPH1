# CYPH/1 Commerce API

Runtime-neutral server-side commerce boundary.

The package still has no public HTTP listener. It now provides a framework-neutral
private checkout handler and PostgreSQL repository for a protected integration
runtime. The normal site build emits no storefront route, and the API remains
disabled unless its independent server gates are explicitly enabled. Its provider-neutral payment boundary
uses a native-HTTP Mollie test adapter, which cannot accept a live API key.

## Safety defaults

- `COMMERCE_ENABLED=false`
- `PAYMENT_PROVIDER=disabled`
- `FULFILMENT_MODE=disabled`
- `FULFILMENT_PROVIDER=disabled`

## Fulfilment boundary

Milestone 3.1 adds a provider-neutral fulfilment service and durable outbox
consumer. Only a database order in `paid` state with a `captured` payment can
cross the boundary. `FULFILMENT_PROVIDER=manual-test` is restricted to
`FULFILMENT_MODE=test`; it creates deterministic references and performs no
external side effect. No production 3PL is configured or approved.

The adapter registry is selected exclusively from server-side configuration.
For isolated Mollie testing, use `PAYMENT_PROVIDER=mollie-test`, a `test_` API
key and an explicit comma-separated `PAYMENT_CALLBACK_ORIGINS` allowlist. Keep
`COMMERCE_ENABLED=false` for normal deployments; no public commerce flow exists
in this milestone. The private test runtime must be protected upstream and pass
its exact preview origin to the checkout handler. CORS is not authentication.

Classic Mollie payment webhooks are parsed from their unmodified raw request
bytes. Because classic notifications are not signed, the body is treated only
as an untrusted payment reference; the adapter authenticates the resource by
retrieving its current state through Mollie's authorised API before producing
a provider-neutral event. Unknown references receive a safe acknowledgement.

Webhook receipts retain the raw body and SHA-256 digest. Payment, order and
exactly-once outbox changes are committed transactionally. No public webhook
route is exposed until the private server runtime is introduced.

Private checkout commands are recorded in `checkout_sessions`. The request
fingerprint, internal order and hosted checkout URL make browser retries durable
and reject reuse of an idempotency key for different basket/address data. Order,
payment and completed checkout-session state are committed atomically.

`PRIVATE_CHECKOUT_UNIT_TAX_MINOR` is an explicit integration-fixture input only.
It is not an approved VAT calculation. Production tax treatment, product price,
stock and fulfilment configuration remain launch-gate inputs.

Configuration fails closed: missing or unrecognised values never enable commerce.

## Database

The schema is maintained as immutable, ordered PostgreSQL migrations in
`db/migrations`. Applied migrations are recorded with a SHA-256 checksum, and
the runner refuses to continue if an applied file has subsequently changed.

```bash
npm run db:migrate --workspace @cyph1/commerce-api
```

`DATABASE_URL` is required. Set `DATABASE_SSL=true` only when the selected
connection requires verified TLS. Render services in the same region should
use the database's internal URL.

The optional development fixture is private, explicitly not for sale, and
guarded against production use:

```bash
ALLOW_DEVELOPMENT_SEED=true npm run db:seed:development --workspace @cyph1/commerce-api
```

Verify a migrated database with transactionally rolled-back constraint checks:

```bash
npm run db:verify --workspace @cyph1/commerce-api
```
