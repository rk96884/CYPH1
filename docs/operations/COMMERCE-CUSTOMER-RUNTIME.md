# Commerce customer runtime

**Status:** Pre-production engineering baseline; no deployment or commerce approval  
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

Setting `CHECKOUT_HTTP_ENABLED=true` does not override `COMMERCE_ENABLED` or
the payment and fulfilment dependency checks. Disabling checkout must use both
the route-exposure and commerce-service gates. Webhook ingestion may remain
available for in-flight payments while checkout is contained.

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

## Controlled staging rehearsal

The following remains a launch-readiness task and needs explicit approval
before execution:

1. Enable the webhook route in the reviewed test environment.
2. Enable checkout routing and the underlying commerce gate for the synthetic
   test fixture only.
3. Create a synthetic sandbox checkout and record its safe correlation IDs.
4. Set `CHECKOUT_HTTP_ENABLED=false` and `COMMERCE_ENABLED=false`, then
   redeploy/restart.
5. Confirm new checkout initiation is unavailable while the Mollie test webhook
   route remains reachable and processes the in-flight notification
   idempotently.
6. Reconcile the synthetic order, then restore all gates to false unless the
   accountable owner authorises continued staging use.

Do not use a real customer identity, address, product, price or payment method
for this exercise.

## Rollback

Follow `COMMERCE-DISABLE-AND-ROLLBACK.md`. Never suspend the protected
operations runtime as a checkout kill switch, never delete order/payment/event
records to make a test pass, and never roll back a database migration ad hoc.
