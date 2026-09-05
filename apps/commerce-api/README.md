# CYPH/1 Commerce API

Server-side commerce boundary with separate protected-operations and customer
runtime entry points.

The package provides framework-neutral handlers plus deliberately narrow Node
listeners. The protected-operations listener exposes generic health checks and
`/operations/*` only. The customer listener exposes generic health checks plus
independently gated `/checkout` and `/webhooks/mollie` routes; it never exposes
operations routes.
The normal site build emits no storefront route, and the API remains
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

## Operations boundary

Milestone 3.2 provides a runtime-neutral `handleOperationsRequest` function,
`OperationsService` and PostgreSQL repository. Authentication middleware must
construct the trusted `OperationsPrincipal`; request headers or browser fields
must never be translated directly into permissions. Independent permissions
cover order reading, refund creation, fulfilment retry and reconciliation
export. See `docs/operations/COMMERCE-OPERATIONS.md` for the protected-origin
deployment and operator workflow.

The staging listener verifies the `Cf-Access-Jwt-Assertion` signature, issuer
and application audience against Cloudflare Access JWKS. It then maps the
verified email only to the server-side `OPERATIONS_ACCESS_GRANTS` allowlist.
Missing, invalid and ungranted assertions fail closed. Build and start it with:

```bash
npm run build:runtime --workspace @cyph1/commerce-api
npm run start:operations --workspace @cyph1/commerce-api
```

See `docs/operations/PROTECTED-COMMERCE-STAGING.md` before deploying it. A
successful build is not authorisation to enable public or live commerce.

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

## Customer runtime boundary

The customer listener is a pre-production engineering boundary, not approval to
sell a product or accept live payments. Build it with `build:runtime` and start
it separately from protected operations:

```bash
npm run build:runtime --workspace @cyph1/commerce-api
npm run start:customer --workspace @cyph1/commerce-api
```

`CHECKOUT_HTTP_ENABLED` and `PAYMENT_WEBHOOKS_ENABLED` accept only the exact
values `true` or `false` and default to false. Checkout additionally remains
subject to `COMMERCE_ENABLED` and its configured dependencies. This permits new
checkout initiation to be contained while verified payment notifications for
in-flight attempts remain available. `CUSTOMER_RUNTIME_ORIGIN` must be the
public HTTPS origin of this listener; it is used when verifying the receiving
webhook endpoint and is never inferred from an untrusted request header. See
`docs/operations/COMMERCE-CUSTOMER-RUNTIME.md` before any deployment.

The private, not-for-sale development fixture remains unavailable unless
`PRIVATE_CHECKOUT_FIXTURE_ENABLED=true`. That switch fails startup unless the
checkout route, commerce gate, Mollie test adapter and manual test fulfilment
boundary are all explicitly enabled. It must be returned to `false` after a
controlled staging rehearsal.

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
