# CYPH/1 Commerce API

Runtime-neutral scaffold for the future server-side commerce boundary.

The API is deliberately non-deployable at this stage. It has no HTTP framework
and exposes no public checkout endpoint. Its provider-neutral payment boundary
uses a native-HTTP Mollie test adapter, which cannot accept a live API key.

## Safety defaults

- `COMMERCE_ENABLED=false`
- `PAYMENT_PROVIDER=disabled`
- `FULFILMENT_MODE=disabled`

The adapter registry is selected exclusively from server-side configuration.
For isolated Mollie testing, use `PAYMENT_PROVIDER=mollie-test`, a `test_` API
key and an explicit comma-separated `PAYMENT_CALLBACK_ORIGINS` allowlist. Keep
`COMMERCE_ENABLED=false`; no public commerce flow exists in this milestone.

Classic Mollie payment webhooks are parsed from their unmodified raw request
bytes. Because classic notifications are not signed, the body is treated only
as an untrusted payment reference; the adapter authenticates the resource by
retrieving its current state through Mollie's authorised API before producing
a provider-neutral event. Unknown references receive a safe acknowledgement.

Webhook receipts retain the raw body and SHA-256 digest. Payment, order and
exactly-once outbox changes are committed transactionally. No public webhook
route is exposed until the private server runtime is introduced.

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
