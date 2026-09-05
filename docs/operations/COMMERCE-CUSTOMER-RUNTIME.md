# Commerce customer runtime

**Status:** Locked-down staging runtime deployed; no checkout, payment or commerce approval
**Scope:** Customer checkout initiation, Mollie test webhook ingestion and runtime containment

## Boundary

The customer runtime is separate from the Cloudflare Access-protected
operations runtime. It exposes only:

- `GET /health` — process liveness with no dependency detail;
- `GET /ready` — database readiness with a generic success or unavailable body;
- `/checkout` — only when `CHECKOUT_HTTP_ENABLED=true`;
- `/webhooks/mollie` — only when `PAYMENT_WEBHOOKS_ENABLED=true`.

Every other path, including `/operations/*`, returns `404`. The runtime does not
serve a storefront, product catalogue or administrative interface.

## Independent gates

Both HTTP exposure variables accept only the exact text `true` or `false` and
default to false. Invalid values stop startup.

| Variable | Normal pre-deployment value | Effect |
| --- | --- | --- |
| `CHECKOUT_HTTP_ENABLED` | `false` | Controls whether `/checkout` is routed |
| `PAYMENT_WEBHOOKS_ENABLED` | `false` | Controls whether `/webhooks/mollie` is routed |
| `COMMERCE_ENABLED` | `false` | Independently controls checkout initiation inside `CheckoutService` |
| `PRIVATE_CHECKOUT_FIXTURE_ENABLED` | `false` | Allows only the private, not-for-sale fixture through the service boundary |

Setting `CHECKOUT_HTTP_ENABLED=true` does not override `COMMERCE_ENABLED` or
the payment and fulfilment dependency checks. Disabling checkout must use both
the route-exposure and commerce-service gates. Webhook ingestion may remain
available for in-flight payments while checkout is contained.

`PRIVATE_CHECKOUT_FIXTURE_ENABLED=true` is valid only with
`CHECKOUT_HTTP_ENABLED=true`, `COMMERCE_ENABLED=true`,
`PAYMENT_PROVIDER=mollie-test`, `FULFILMENT_MODE=test` and
`FULFILMENT_PROVIDER=manual-test`. Any incomplete or differently cased
configuration fails startup. The switch does not publish a catalogue item or
permit an active product; it admits the deliberately private fixture solely for
the controlled rehearsal below.

## Required server-only configuration

In addition to `DATABASE_URL` and the existing payment configuration, an
authorised test deployment requires reviewed values for:

- `CUSTOMER_RUNTIME_ORIGIN`, containing only the public HTTPS origin of this
  listener (no path, query or fragment);
- `PRIVATE_STOREFRONT_ORIGIN`;
- `CHECKOUT_ORDER_STATUS_URL`;
- `CHECKOUT_CANCELLATION_URL`;
- `PAYMENT_WEBHOOK_URL`;
- `PRIVATE_CHECKOUT_UNIT_TAX_MINOR` (integration fixture only);
- `PAYMENT_CALLBACK_ORIGINS`;
- `MOLLIE_API_KEY` using a `test_` credential only.

None may use the `PUBLIC_` prefix. Do not copy secrets into GitHub issues,
screenshots, logs or this runbook.

## Build and start

```powershell
npm ci
npm run build:runtime --workspace @cyph1/commerce-api
npm run start:customer --workspace @cyph1/commerce-api
```

The start command binds to `PORT` (default `3000`). A successful start is not
approval to expose the listener publicly. Configure a separate Render service
or equivalent; do not replace the protected operations service.

## Pre-deployment checks

1. Confirm the exact source commit and all database migrations.
2. Keep `CHECKOUT_HTTP_ENABLED=false`, `PAYMENT_WEBHOOKS_ENABLED=false` and
   `COMMERCE_ENABLED=false` for the initial health/readiness deployment.
3. Verify `/health` returns `200`, `/ready` returns `200` only with a working
   database, and `/checkout`, `/webhooks/mollie` and `/operations/orders` all
   return `404`.
4. Review the origin and callback URL allowlists against the actual staging
   hostnames. Confirm `CUSTOMER_RUNTIME_ORIGIN` exactly matches the public
   customer listener origin; the runtime does not trust forwarded host headers
   to construct the webhook verification URL.
5. Confirm the credential is a Mollie test key and no live payment provider is
   configured.
6. Record privacy-safe deployment and request evidence only.

## Locked-down staging deployment evidence

Verified on 1 September 2026 against source commit `64ac621`.

- Render service: `cyph1-commerce-customer-staging`;
- public origin: `https://cyph1-commerce-customer-staging.onrender.com`;
- database: Render PostgreSQL internal connection, with `DATABASE_SSL=false` as
  required for the internal URL;
- `CHECKOUT_HTTP_ENABLED=false`;
- `PAYMENT_WEBHOOKS_ENABLED=false`;
- `COMMERCE_ENABLED=false`;
- `PAYMENT_PROVIDER=disabled`;
- `FULFILMENT_MODE=disabled` and `FULFILMENT_PROVIDER=disabled`.

The following boundary checks were completed successfully after deployment:

| Request | Verified result |
| --- | --- |
| `GET /health` | `200` with `{"status":"ok"}` |
| `GET /ready` | `200` with `{"status":"ready"}` |
| `/checkout` | `404` with `{"message":"Not found."}` |
| `/webhooks/mollie` | `404` with `{"message":"Not found."}` |
| `/operations/orders` | `404` with `{"message":"Not found."}` |

This evidence confirms process liveness, PostgreSQL readiness, disabled
customer commerce routes and isolation from the operations surface. It does
not approve checkout, payment processing, product publication or public
launch. All three commerce exposure gates must remain false until a separately
reviewed staging rehearsal is authorised.

### Custom-domain verification

Verified on 1 September 2026 after the locked-down deployment checks above.

- custom origin: `https://commerce-staging.cyph1.co.uk`;
- Cloudflare DNS: `CNAME` from `commerce-staging.cyph1.co.uk` to
  `cyph1-commerce-customer-staging.onrender.com`, set to DNS only;
- Render custom-domain status: verified;
- Render TLS status: certificate issued;
- `GET /health`: `200` with `{"status":"ok"}`;
- `GET /ready`: `200` with `{"status":"ready"}`.

The direct Render subdomain remains enabled as an operational fallback. The
custom-domain checks confirm public DNS resolution, HTTPS termination, process
liveness and PostgreSQL readiness only. They do not approve a storefront,
checkout, payment processing or launch. `CHECKOUT_HTTP_ENABLED`,
`PAYMENT_WEBHOOKS_ENABLED` and `COMMERCE_ENABLED` remained `false` throughout
verification.

## Controlled staging rehearsal

The synthetic database fixture is installed separately from migrations and
normal deployment. It contains a private £1 test item, ten synthetic inventory
units and a £1 UK test-delivery rate. These are integration values only—not
product, pricing, inventory, tax, fulfilment or shipping decisions.

Install it only against the named Render development/staging database, after
reviewing the target URL:

```powershell
$env:DATABASE_URL = "<Render external database URL>"
$env:DATABASE_SSL = "true"
$env:ALLOW_PRIVATE_CHECKOUT_STAGING_SEED = "true"
$env:PRIVATE_CHECKOUT_STAGING_SEED_CONFIRM = "integration-test-fixture"
npm run db:seed:private-checkout-staging
Remove-Item Env:DATABASE_URL
Remove-Item Env:DATABASE_SSL
Remove-Item Env:ALLOW_PRIVATE_CHECKOUT_STAGING_SEED
Remove-Item Env:PRIVATE_CHECKOUT_STAGING_SEED_CONFIRM
```

Expected output:

```text
Installed private checkout staging fixture: integration-test-fixture
Shipping rate: 00000000-0000-4000-8000-000000000703
```

Staging evidence recorded on 5 September 2026: the guarded command completed
against the named Render non-production database and returned both expected
lines above. No database URL, credential or customer data is retained in this
record. This confirms fixture installation only; it does not evidence a Mollie
checkout, webhook, payment or refund rehearsal.

The command refuses production mode, requires two explicit guard values and
rejects database names that do not contain `development`, `staging` or `test`.
It verifies the complete fixture before committing and rolls back on failure.
It is idempotent, but must not be added to Render's build, pre-deploy or start
commands.

The following remains a launch-readiness task and needs explicit approval
before execution:

1. Enable the webhook route in the reviewed test environment.
2. Enable checkout routing and the underlying commerce gate for the synthetic
   test fixture only by setting `PRIVATE_CHECKOUT_FIXTURE_ENABLED=true` with
   the complete test configuration documented above.
3. Create a synthetic sandbox checkout and record its safe correlation IDs.
4. Set `CHECKOUT_HTTP_ENABLED=false` and `COMMERCE_ENABLED=false`, then
   redeploy/restart.
5. Confirm new checkout initiation is unavailable while the Mollie test webhook
   route remains reachable and processes the in-flight notification
   idempotently.
6. Reconcile the synthetic order, then restore `CHECKOUT_HTTP_ENABLED`,
   `COMMERCE_ENABLED`, `PAYMENT_WEBHOOKS_ENABLED` and
   `PRIVATE_CHECKOUT_FIXTURE_ENABLED` to `false` unless the accountable owner
   authorises continued staging use.

Do not use a real customer identity, address, product, price or payment method
for this exercise.

## Rollback

Follow `COMMERCE-DISABLE-AND-ROLLBACK.md`. Never suspend the protected
operations runtime as a checkout kill switch, never delete order/payment/event
records to make a test pass, and never roll back a database migration ad hoc.
