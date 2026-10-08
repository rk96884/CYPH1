# Commerce customer runtime

**Status:** Locked-down staging runtime deployed; no checkout, payment or commerce approval
**Scope:** Customer checkout initiation, Mollie test webhook ingestion and runtime containment

## Boundary

The customer runtime is separate from the Cloudflare Access-protected
operations runtime. It exposes only:

- `GET /health` — process liveness with no dependency detail;
- `GET /ready` — database readiness with a generic success or unavailable body;
- `/checkout/quote` — authoritative shipping/basket quote under the checkout gate;
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
checkout initiation and shipping quotes; it never limits payment webhooks or health/readiness.

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



### Failed card attempt rehearsal — 21 September 2026

A fresh synthetic GBP £2 checkout (`CYPH-T-2F05E471E91E`, order `2f05e471-e91e-48ea-8e9e-8f3ea8b60714`) was submitted through Mollie test mode using the card test flow and the `Failed` outcome. Mollie History recorded the credit-card attempt as failed because 3-D Secure authentication failed, then returned to payment-method selection while the parent payment remained `Open`. CYPH/1 Operations remained order `pending_payment`, payment `pending`, fulfilment `unfulfilled`, with no refunds and no fulfilments. This passes the safety assertion that a failed payment attempt cannot be mistaken for authoritative payment or trigger fulfilment. A terminal parent-payment `failed` state could not be reproduced through this GBP test checkout; that scenario remains unverified and is recorded as a provider-test limitation rather than a pass.
**Result:** passed for completed partial-refund reconciliation and duplicate webhook safety. No duplicate refund was created during replay. A second £1.00 refund was then initiated in Mollie test mode. While that refund was pending, CYPH/1 correctly remained `partially_refunded`; Mollie did not send a webhook for that observed pending interval. When the second refund completed, Mollie's normal webhook delivery reached CYPH/1 without manual replay. Operations then showed order and payment `refunded`, two distinct completed GBP refunds of 100 minor units each, and fulfilment still `unfulfilled`. This passes the full-refund-after-partial lifecycle rehearsal.

## Rollback

Follow `COMMERCE-DISABLE-AND-ROLLBACK.md`. Never suspend the protected
operations runtime as a checkout kill switch, never delete order/payment/event
records to make a test pass, and never roll back a database migration ad hoc.


### Explicit cancellation investigation — 21 September 2026

A fresh synthetic £2 GBP checkout (`CYPH-T-908A811154A7`) was inspected for an explicit cancellation path. The Mollie hosted payment-method screen and card-entry flow exposed only navigation back, not cancellation. The test-status simulator offered `Open`, `Paid`, `Failed` and `Expired`, but no `Canceled` outcome. The Mollie dashboard likewise exposed no Cancel action for the open test payment. During the investigation, the individual card attempt expired and Mollie returned to payment-method selection while the parent payment remained `Open`. Previous-page navigation is therefore not treated as authoritative cancellation. A terminal parent-payment `canceled` state could not be reproduced through the current Mollie GBP test checkout and remains unverified as a provider-test limitation rather than being marked passed or failed.


### Timeout / ambiguous provider safety — automated evidence, 21 September 2026

The current `main` implementation was inspected for the ambiguous payment-creation path. The Mollie adapter uses an `AbortController` with a bounded request timeout (10 seconds by default) and maps timeout/network failure to a retryable `PaymentProviderError("network_error")`. The automated payment test deliberately supplies a provider request that never resolves, allows the abort signal to fire, and asserts the retryable network-error classification.

Checkout-service coverage separately injects that retryable provider error during `createCheckout()` and asserts that the draft order is retained and marked resolution-required, is not abandoned, and the caller receives a provider error. Payment attachment occurs only after a definite provider checkout response has returned, so the ambiguous path does not attach a provider payment, transition the order to `pending_payment`, assume payment success, or create fulfilment. **Result: PASSED by controlled automated evidence.** A deliberate staging network disruption was not performed because it would add operational risk without exercising materially different application logic.


### Final payment reconciliation — 21 September 2026

Final reconciliation rechecked the completed refund rehearsal and the non-paid edge cases. The fully refunded £2 test order remained stable as order/payment `refunded`, with two distinct completed £1 GBP refunds and no fulfilment. The earlier failed-card-attempt order naturally reconciled to payment `expired`, while its order remained `pending_payment`, with no refunds or fulfilments.

For fresh order `CYPH-T-908A811154A7` (order `908a8111-54a7-4891-9351-f69bf0b58b1f`), Mollie's dashboard later displayed the parent payment as `Failed`, but its visible History showed no natural webhook for that terminal dashboard transition. A controlled classic-webhook replay was then sent to the configured CYPH/1 webhook endpoint. The handler returned successfully and, after authoritative provider retrieval, Operations persisted the payment as `expired` rather than `failed`. The order remained `pending_payment`, fulfilment remained `unfulfilled`, and both refunds and fulfilments remained empty. This demonstrates that CYPH/1 follows the provider API state retrieved during webhook verification rather than inferring success or failure from browser/dashboard presentation. The Mollie test dashboard/API discrepancy is recorded as provider-test evidence; terminal API `failed` remains unverified. The safety assertion passed: no non-paid scenario produced fulfilment.


### Staging payment-test closure — 21 September 2026

Following the completed Mollie lifecycle/reconciliation exercise, the customer staging service was returned to its fail-closed configuration and successfully redeployed from `main`. Post-deploy verification confirmed the expected locked-baseline route behaviour: `GET /health` → 200, `GET /ready` → 200, `GET /checkout` → 404, and `GET /webhooks/mollie` → 404. The active payment-test window is therefore closed; checkout, commerce, webhooks and the private checkout fixture are disabled, with payment and fulfilment providers disabled.

## International shipping preparation

**Controlled Mollie test checkout only; no live activation or gate closure.**
Assigned ISO 3166-1 alpha-2 codes replace free-text country matching. The
reviewed pricing map in `packages/commerce-core/src/countries.ts` assigns GB
£3.99; UN M49 Europe plus Cyprus and Turkey £14.99; all other assigned codes
£25.99. Crown dependencies/overseas territories use their own ISO code; GB is
the only UK pricing code. Classification is not EU membership or approval to
export to every listed country. Sources: [ISO country codes](https://www.iso.org/iso-3166-country-codes.html)
and [UN M49 regions](https://unstats.un.org/unsd/methodology/m49/overview/).
Charges are GBP, once per shipment/basket, including tracked postage and
packing, additional to £74.99. The synthetic test product remains £1. The
historical £1 shipping seed is no longer checkout-eligible; the new server
quote replaces the optional legacy PUBLIC_COMMERCE_TEST_SHIPPING_RATE_ID.
The private UI defaults to Mollie hosted test-method selection; the existing
explicit Klarna test path remains selectable where the provider supports it.

`POST /checkout/quote` accepts productSlug, quantity and countryCode; returns
products, tax, postage/packing and total in integer minor units, and creates
no order/payment. It shares existing checkout exposure, origin, request-bound
and admission controls. Payment initiation recalculates the basket, ignoring
client amounts/zone/currency; checks the rate ID, ISO destination, exact flat
price, validity and weight/subtotal limits; rejects a changed reviewed total;
and rechecks approval/price under row locks in the order transaction.
Unconfigured, disabled and restricted destinations fail closed. Test approvals
require the private fixture boundary AND Mollie test AND test/manual-test
fulfilment. Live eligibility requires active destination, zone, method AND
rate; test configuration cannot bypass this chain. Tax logic is unchanged:
this implementation does not decide export VAT treatment or collect import tax.

Before international payment, display and require acknowledgement:

> International import duties, taxes and customs clearance charges are not
> included in your order total and must be paid separately by the recipient
> where applicable.

Order snapshots retain country, charge/version and acknowledgement/notice
version. Confirmation emails use persisted item and postage/packing totals
and repeat the disclosure; international dispatch emails repeat it too.
£299 preview fixtures remain unchanged. UAE addresses do not require a
postcode; other addresses currently do. Review additional country-specific
address exceptions before approving those destinations.

### Isolated test setup

Existing tables suffice; no new migration is required. Install the existing
private fixture first. Against a reviewed non-production DATABASE_URL whose
name contains a separate development/staging/test component, run:

```powershell
$env:NODE_ENV = "test"
$env:PAYMENT_PROVIDER = "mollie-test"
$env:COMMERCE_ENABLED = "false"
$env:SHIPPING_SETUP_CONFIRM = "international-test-only"
$env:SHIPPING_TEST_COUNTRIES = "GB,DE,FR,TR,AE,SA,US,CA,AU"
# DATABASE_URL and DATABASE_SSL must already identify the reviewed isolated DB.
npm run build:runtime --workspace @cyph1/commerce-api
node apps/commerce-api/scripts/configure-international-shipping.mjs
Remove-Item Env:SHIPPING_SETUP_CONFIRM
Remove-Item Env:SHIPPING_TEST_COUNTRIES
```

Separate from deployment/startup, setup creates test zones/method and
country-specific rates. Only explicitly listed codes receive test destination
approval; all others are disabled. Empty list approves none; rerunning replaces
the test allowlist, so include every intended test country. Existing active
or restricted shipping configuration causes rollback. Existing legacy test
zone/FKs are retained; ISO country determines price. Setup never enables
commerce or changes credentials. Follow the existing authorised staging
rehearsal procedure separately; do not change production environment values.

### Individual live country approval after GO-01

No code change is needed. A named operator records country-specific
product/compliance, carrier/customs and policy approval, then reviews the exact
destination, zone, tracked-postage-packing method and rate IDs in a transaction.
If missing in production, provision those rows in disabled status through the
reviewed database-configuration process first, using the ISO mapping and exact
GBP flat amount above; never run the test setup command on production. No
application code change is required for either provisioning or approval:

```sql
BEGIN;
SELECT c.country_code,c.destination_status,z.id AS zone_id,z.status,
       m.id AS method_id,m.status,r.id AS rate_id,r.rate_minor,r.currency,r.status
FROM shipping_zone_countries c JOIN shipping_zones z ON z.id=c.zone_id
JOIN shipping_rates r ON r.zone_id=z.id AND r.country_code=c.country_code
JOIN shipping_methods m ON m.id=r.shipping_method_id
WHERE c.country_code='DE' AND m.method_key='tracked-postage-packing';
-- After approval: set ONLY the reviewed zone, method and DE rate IDs active.
-- UPDATE shipping_zones SET status='active' WHERE id=<reviewed-zone-id>;
-- UPDATE shipping_methods SET status='active' WHERE id=<reviewed-method-id>;
-- UPDATE shipping_rates SET status='active' WHERE id=<reviewed-DE-rate-id>;
UPDATE shipping_zone_countries SET destination_status='active',updated_at=now()
WHERE country_code='DE' AND destination_status IN ('disabled','test');
ROLLBACK;
```

Example deliberately rolls back. Substitute approved IDs and commit only
under separately authorised activation. Shared zone/method activation cannot
approve another country: its own destination AND rate must also be active.
Do not promote every test country. The guarded setup command is test-only;
production data changes require the reviewed operational process above.
Restrict/revoke individual countries using disabled, or restricted plus a
restriction_reason. This blocks new checkouts; already-issued Mollie sessions
need existing in-flight-payment containment/reconciliation, not an assumption
that changing configuration cancels a provider session.

Rehearse GB, DE, FR, TR, AE, SA, US, CA, AU: 399/1499/2599 minor-unit charges,
quantity changes, immutable totals/email breakdowns, international disclosure,
rate/amount tampering, unapproved destinations, approval revocation and
existing duplicate/uncertain-payment, webhook, status and dispatch behaviour.
Automated provider-boundary tests are not real hosted Mollie test payments;
retain separately authorised sandbox-payment evidence. No real payment,
email, deployment or database setup is executed by these unit tests. Existing
compliance/operational gates and GO-01 remain open.

## Operations order-list shipping reconciliation

The protected `GET /operations/orders` response preserves all existing fields
and adds these fields to each order:

- `destinationCountryCode`: assigned ISO 3166-1 alpha-2 string or `null`, from
  the persisted `orders.delivery_address_snapshot.countryCode`. Missing or
  invalid codes return null; no zone, total or customer-email inference.
- `deliveryMinor`: non-negative safe integer or `null`, from the original
  `orders.delivery_minor` checkout charge. Missing/unrepresentable values return
  null; recorded zero remains zero. Current shipping rates are never consulted.

Example (synthetic identifiers):

```json
{"orders":[{"id":"00000000-0000-4000-8000-000000000001","orderNumber":"CYPH-T-EXAMPLE","status":"paid","fulfilmentStatus":"unfulfilled","currency":"GBP","totalMinor":1599,"destinationCountryCode":"DE","deliveryMinor":1499,"createdAt":"2026-10-08T11:54:06.149Z"}]}
```

Use the existing Cloudflare Access-protected operations origin and an authorised
`orders:read` principal; search each synthetic order number using the existing
`q` parameter. Compare country, deliveryMinor, currency, totalMinor and status
against persisted order evidence, not against expected destination labels alone.
Do not include addresses, names, email addresses, tokens or credentials in evidence.
The customer runtime continues to reject `/operations/*`. No UI or detail-response
change, migration, shipping configuration or payment/fulfilment mutation is required.

Read-only verification on 8 October 2026 against the approved development database
confirmed the following persisted synthetic records; all were paid/unfulfilled,
with currency GBP:

| Order number | Address country | deliveryMinor | totalMinor |
| --- | --- | ---: | ---: |
| CYPH-T-BFD36D955FDE | DE | 1499 | 1599 |
| CYPH-T-6646BFD7281B | TR | 1499 | 1599 |
| CYPH-T-3C619E4701A4 | AE | 2599 | 2699 |
| CYPH-T-5AA204B91F85 | GB | 399 | 499 |
| CYPH-T-EE574EB5BA0B | US | 2599 | 2699 |

The compiled operations repository query and response mapper also passed against
all five records inside a read-only PostgreSQL transaction. This verifies stored
values and repository behaviour, not deployed API behaviour or webhook provenance.
The schema historically makes delivery_minor non-null with default zero; a stored
zero cannot establish whether an older importer omitted the original charge.
No historical amount is reconstructed. Incomplete address snapshots return null.

After approval, deploy only the operations staging service from the reviewed
commit, preserving its Access configuration and all disabled commerce/worker
controls. Verify unauthenticated access remains rejected, then read these five
orders through the protected endpoint and compare the table above. Do not create
payments, refunds, dispatches or fulfilments to verify this read-only change.
No deployment or launch-gate closure is authorised by this evidence.

## Immutable shipping-pricing evidence (snapshot schema version 2)

New application checkouts extend the existing `orders.shipping_rate_snapshot`
JSON atomically with the order, item and idempotency reservation. Existing
`shipping_rate_id`, `shipping_country_code`, `delivery_minor`, currency and
`shipping_method_snapshot` fields are reused; no duplicate address or rate table
is introduced. The method snapshot preserves the selected key, display name and
description. The rate snapshot retains amountMinor, currency, numeric version,
zoneKey, countryCode and import-charge acknowledgement, and adds:

- schemaVersion: 2;
- rateRevision: SHA-256 content identity of the selected rate ID/version, method,
  zone/destination scope, amount/currency, eligibility/weight boundaries and dates;
- quoteRevision: opaque calculation identity binding rate revision, destination,
  product ID/unit price/tax, quantity, shipment weight and total;
- selectedAt: server timestamp when checkout selects the rate;
- rateCountryCode, effectiveFrom/effectiveTo and freeShippingThresholdMinor:
  original rate scope/validity and threshold (null for current non-free rates);
- quantity and totalWeightGrams (product shipping weight multiplied by quantity);
- minimumWeightGrams / maximumWeightGrams and minimumSubtotalMinor /
  maximumSubtotalMinor: applied boundaries, null when unrestricted;
- billableWeightGrams and packagingProfileVersion: null. No separate volumetric,
  rounded billable weight or packaging calculation currently exists; do not invent
  these inputs or interpret totalWeightGrams as a verified final packed weight.

### Quote consistency and privacy

The private quote endpoint returns only an opaque shippingQuoteRevision in
addition to its existing customer pricing response; it does not expose weight
bands, packaging internals or detailed snapshots. The checkout HTTP endpoint
requires this 64-character revision. The private UI forwards the reviewed
revision with expectedTotalMinor. A changed rate revision, quantity, weight,
product price/tax, destination or total requires a fresh quote before payment.
The token is a change detector, not payment authority: the server independently
calculates price and rechecks approval, rate content, quantity/weight, product
price/weight/status and total under database locks before committing the order.
No client amount can set the charge. In-process callers without a prior quote
still obtain a new authoritative server calculation; they cannot supply a stale
revision and have it ignored.

The existing idempotency fingerprint includes the reviewed revision. Completed
retries return the original order/session without repricing or replacing evidence;
conflicting/in-progress keys fail closed. Database validation failures roll back
the reservation, address and order before any provider call. Definite payment
failure preserves the original evidence on the cancelled order; uncertain payment
creation preserves it for resolution-required handling without blind retries.

### Revision lifecycle and migration deployment

Migration `0018_shipping_pricing_evidence.sql` adds two immutability triggers,
without modifying any existing orders, payments, rates or snapshots. Pricing,
weight/subtotal boundaries, currency, scope, effective dates and numeric version
cannot be updated in place. Insert a new rate row with a new ID and incremented
version for the same destination/method; retire the previous row using status.
Do this transactionally to avoid overlapping eligible rates (checkout rejects
ambiguous matches). Status changes remain available for immediate containment.
Method/zone changes are also detected by content identity; old method names and
applied zone values remain preserved in order snapshots.

Order rate ID, destination, method/rate snapshots and original delivery charge
cannot be overwritten after insertion, including on older records. Status,
payment, refund and dispatch lifecycle updates remain permitted. Historical
records missing all or some metadata remain readable; no backfill reconstructs
unknown pricing evidence. Snapshot schema version absent means legacy evidence,
not proof that weight or packaging inputs were recorded.

Deployment order: contain checkout and verify in-flight session handling; apply
0018 through the checksum-aware migration runner to the explicitly approved
environment; deploy the API and private checkout UI together; verify a fresh
quote/revision and protected detail read before any separately approved reopening.
Old private clients without a revision now fail closed and must refresh. Do not
re-run historical seed scripts that would change existing pricing revisions.
No migration, rate activation or deployment is applied by this implementation.

### Operations audit and verification

`GET /operations/orders/:id` exposes shippingPricingEvidence containing rateId,
countryCode, method and rate snapshots under the unchanged `orders:read` grant
and Cloudflare Access boundary. Null means no rate snapshot exists; a legacy
partial snapshot is returned as stored. Use its stored amount/revision/inputs and
order delivery charge to audit; never recalculate historical charges from current
shipping tables. General order lists retain only destinationCountryCode and
deliveryMinor alongside their existing fields. Public order-status responses do
not include pricing configuration.

Automated regression: commerce tests cover revision/quantity changes, weight and
destination capture, stale quotes, idempotent replay, protected historical detail
reads and failed/uncertain initiation. For a fresh empty disposable **loopback**
PostgreSQL database named `shipping_snapshot_test`, build the runtime, set
SHIPPING_SNAPSHOT_TEST_DATABASE_URL to that local connection and run
`node apps/commerce-api/scripts/test-shipping-snapshots.mjs` from repository root.
The script refuses other hosts/database names and nonempty schemas, applies the
migrations only there, and tests immutable revisions/order evidence, preserved
historical charges, versioned weight bands, retries, failed initiation and
transactional rollback. Never point it at staging or production.

Local evidence — 8 October 2026: all 18 migrations and the integration verifier
passed on a fresh PostgreSQL 17 loopback cluster. The test cluster was shut down
afterwards. No staging or production migration or data change was performed.
