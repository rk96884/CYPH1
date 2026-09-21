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

When `CHECKOUT_HTTP_ENABLED=true`, the runtime also requires explicit
`CHECKOUT_ADMISSION_MAX_CONCURRENT`, `CHECKOUT_ADMISSION_WINDOW_REQUESTS` and
`CHECKOUT_ADMISSION_WINDOW_SECONDS` values. See
`CHECKOUT-ABUSE-AND-RATE-LIMITING.md`. The application controller limits only
checkout initiation; it never limits payment webhooks or health/readiness.

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
- the three `CHECKOUT_ADMISSION_*` values whenever checkout routing is enabled.

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

### Route-gate verification

The repository includes a read-only verifier for each deliberate route state.
It sends only `GET` requests, so it cannot create a checkout or submit a webhook.
Run it after each corresponding Render configuration deployment:

```powershell
$env:CUSTOMER_RUNTIME_ORIGIN = "https://commerce-staging.cyph1.co.uk"

$env:CUSTOMER_ROUTE_GATE_MODE = "disabled"
npm run verify:customer-route-gates

$env:CUSTOMER_ROUTE_GATE_MODE = "active"
npm run verify:customer-route-gates

$env:CUSTOMER_ROUTE_GATE_MODE = "contained"
npm run verify:customer-route-gates

Remove-Item Env:CUSTOMER_ROUTE_GATE_MODE
Remove-Item Env:CUSTOMER_RUNTIME_ORIGIN
```

Expected status pairs are:

| Mode | `/checkout` | `/webhooks/mollie` |
| --- | --- | --- |
| `disabled` | `404` | `404` |
| `active` | `405` with `Allow: POST` | `405` with `Allow: POST` |
| `contained` | `404` | `405` with `Allow: POST` |

The `contained` result proves only that the HTTP gates are independent. The
rehearsal is not complete until an authenticated Mollie test notification for
the in-flight synthetic payment is processed idempotently and reconciled.

On **7 September 2026**, the verifier ran against
`https://commerce-staging.cyph1.co.uk` in `disabled` mode and confirmed
`/checkout` and `/webhooks/mollie` both returned the exact expected `404`
response. No checkout or webhook request was submitted.

### Mollie checkout-disable/webhook-continuity rehearsal

Completed on **18 September 2026** against the staging customer runtime and
Mollie test mode using synthetic data only.

- Supporting callback, admission and test-provider configuration was staged
  while checkout, commerce and webhook gates remained disabled.
- Webhook-only exposure was verified first: `/checkout` returned `404` while
  browser `GET /webhooks/mollie` returned `405`.
- The guarded private fixture was then enabled with `PAYMENT_PROVIDER=mollie-test`,
  `FULFILMENT_MODE=test` and `FULFILMENT_PROVIDER=manual-test`.
- Active routing was verified: browser `GET` requests to both `/checkout` and
  `/webhooks/mollie` returned `405`.
- One synthetic checkout was created for the private £1 integration fixture plus
  the £1 integration delivery rate. Mollie displayed a £2.00 test-mode payment.
- Before completing that payment, checkout creation was contained by restoring
  `CHECKOUT_HTTP_ENABLED=false`, `COMMERCE_ENABLED=false` and
  `PRIVATE_CHECKOUT_FIXTURE_ENABLED=false`, while keeping the Mollie test
  webhook route available. The contained boundary was verified as checkout
  `404` and webhook `405`.
- Mollie test mode was then completed with the `Paid` outcome. The browser
  returned to the deliberately non-authoritative pending page.
- The protected operations runtime independently reconciled internal order
  `6e6eb2e4-a264-478b-a47e-6693ae15fcb0` / order number
  `CYPH-T-6E6EB2E4A264` as `status: paid`, `fulfilmentStatus: unfulfilled`,
  currency `GBP`, total minor units `200`.
- The customer runtime was finally restored to the locked-down baseline:
  checkout, commerce, webhook and private-fixture gates false; payment and
  fulfilment providers disabled. Post-redeploy checks returned `200` for
  `/health` and `/ready`, and `404` for both `/checkout` and
  `/webhooks/mollie`.

This evidence demonstrates the intended staging containment property: an
in-flight Mollie test payment can be authoritatively reconciled after new
checkout initiation is disabled. It does **not** approve live payments,
production checkout, fulfilment or public launch.

### Mollie expired-payment rehearsal

Completed on **21 September 2026** using a fresh synthetic £2.00 staging order. Mollie test mode was exercised with the card outcome set to `Expired`. Protected operations evidence for order `CYPH-T-F8A5BA010838` showed the order remained `pending_payment`, the associated `mollie-test` payment transitioned to `expired`, and fulfilment remained `unfulfilled`. The payment update timestamp advanced after creation, providing database evidence that the terminal payment-state update was processed rather than inferred from the browser UI. No refund or fulfilment record was created.

**Result:** passed for the safety property under test: an expired Mollie test payment does not mark the order paid and does not initiate fulfilment.

**Follow-up:** the current domain model leaves the order at `pending_payment` for terminal non-paid payment states. The customer-facing pending copy and retry/abandonment lifecycle therefore require an explicit product/operations decision before production. This rehearsal does not evidence an explicit customer cancellation or a terminal failed-payment webhook.

### Mollie failed-attempt rehearsal

Exercised on **21 September 2026** using a fresh synthetic £2.00 staging order. Mollie test checkout was exercised with the card outcome set to `Failed`. Mollie returned to payment-method selection rather than producing an observed terminal provider failure. After leaving the payment flow, protected operations evidence for order `CYPH-T-3ED7551BFDD8` continued to show the order as `pending_payment`, the associated `mollie-test` payment as `pending`, and fulfilment as `unfulfilled`. The payment `updated_at` value had not advanced from creation, so no persisted payment-state update was evidenced.

**Result:** inconclusive for terminal failed-payment handling. The observed failed card attempt did not establish a terminal `failed` provider payment. The safety boundary nevertheless held: the order was not marked paid and no fulfilment or refund was created.

**Follow-up:** retain terminal failed-payment handling as an open sandbox test. Do not treat a failed card attempt that leaves the provider payment `pending` as evidence of a `payment.failed` lifecycle transition. Customer cancellation also remains separately untested.

### Mollie abandoned-checkout / natural-expiry rehearsal

Completed on **21 September 2026** using fresh synthetic £2.00 order `CYPH-T-CA8AF7C5A50C`. The shopper entered Mollie hosted checkout but did not complete payment. Mollie's own **Previous page** control returned the browser to the configured CYPH/1 pending/status route rather than the cancellation route. Protected operations evidence initially showed the order as `pending_payment`, payment as `pending`, fulfilment as `unfulfilled`, and identical payment creation/update timestamps.

Mollie's test dashboard subsequently showed the overall payment as `Open` with a short expiry window. Its history showed an individual credit-card attempt had expired while the overall payment returned to payment-method selection. After the overall hosted checkout naturally expired, Mollie showed the payment as `Expired`. CYPH/1 then authoritatively persisted the associated payment as `expired`; its `updated_at` advanced from `2026-09-21T09:33:42.876Z` to `2026-09-21T10:50:42.007Z`. The order remained `pending_payment`, fulfilment remained `unfulfilled`, and no refund or fulfilment record was created.

**Result:** passed for abandoned-checkout/natural-expiry safety and webhook persistence. Abandonment did not create a paid order or fulfilment, and the later terminal expiry was persisted independently of the browser return.

**Additional finding:** the earlier order `CYPH-T-3ED7551BFDD8`, used for the `Failed` card-attempt rehearsal, was later shown by Mollie as `Expired`. That exercise therefore remains inconclusive for a terminal `failed` provider state; it must not be counted as a failed-payment pass.

**Follow-up:** Mollie's **Previous page** behaviour observed here is a normal return/navigation path, not evidence of explicit payment cancellation. A genuine `canceled` provider-state exercise remains open. The repeated observation that terminal `expired` payments leave the internal order at `pending_payment` reinforces the need for an explicit retry/abandonment order-lifecycle and customer-copy decision before production.

### Mollie partial-refund reconciliation rehearsal

Completed on **21 September 2026** against Mollie test mode using existing synthetic £2.00 paid order `CYPH-T-6E6EB2E4A264`. Mollie had completed a £1.00 partial refund, but the pre-fix CYPH/1 webhook path left the internal order `paid`, payment `captured` and refunds empty. This exposed a defect: classic Mollie payment webhooks retrieved only payment status and did not reconcile authoritative refund resources.

A dedicated fix branch added authoritative refund discovery and refund lifecycle events, persisted provider refund identity/amount/status, and derived payment/order `partially_refunded` or `refunded` state from completed refund totals. The commerce regression suite passed **69/69** tests before staging deployment. Source commit `85b0129` was deployed to `cyph1-commerce-customer-staging`; health returned `200` and browser GET checks returned `405` for both active checkout and webhook routes.

The existing payment notification was then replayed to the customer webhook. The runtime retrieved Mollie's authoritative state and protected operations showed order and payment `partially_refunded`, exactly one completed GBP refund of 100 minor units, and fulfilment still `unfulfilled`. Replaying the same notification again returned success and left exactly one refund record with unchanged financial state, demonstrating duplicate-delivery idempotency for this scenario.

**Result:** passed for completed partial-refund reconciliation and duplicate webhook safety. No second refund was initiated and the remaining refundable amount at Mollie remained £1.00. Full-refund-after-partial remains a separate staging exercise before this refund lifecycle is considered complete.

## Rollback

Follow `COMMERCE-DISABLE-AND-ROLLBACK.md`. Never suspend the protected
operations runtime as a checkout kill switch, never delete order/payment/event
records to make a test pass, and never roll back a database migration ad hoc.
