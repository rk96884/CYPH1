# Checkout abuse and rate limiting

**Status:** Staging application, Cloudflare edge, direct-origin and authenticated webhook-under-saturation rehearsals passed; production thresholds and operational ownership outstanding  
**Last engineering update:** 23 September 2026

## Purpose

Protect checkout, PostgreSQL and the payment provider from automated or burst
abuse without delaying verified payment webhooks or relying on an untrusted
client IP header. This is a capacity and abuse control, not fraud detection and
not a substitute for provider-side payment controls.

## Layered boundary

1. **Cloudflare edge:** before public checkout, proxy the customer custom domain
   and apply a reviewed checkout-specific rate rule or challenge. Do not apply
   the same limit to `/webhooks/mollie`, `/health` or `/ready`.
2. **Origin exposure:** remove or restrict the direct Render subdomain before
   launch so an attacker cannot bypass the Cloudflare policy. On 23 September
   2026 the staging Render subdomain was disabled and independently verified as
   blocked; production must repeat and record the same control before launch.
3. **Application admission:** the customer runtime caps concurrent and
   rolling-window `POST /checkout` requests per process. It ignores forwarded
   IP headers and returns a generic `429` with `Retry-After` when saturated.
4. **Commerce invariants:** server-side totals, stock checks, idempotency and
   payment-state reconciliation remain authoritative after admission.

Application admission deliberately excludes webhook ingestion. An incident
owner may disable new checkout while keeping authenticated provider
notifications available for in-flight payments.

## Required server configuration

An enabled checkout route now requires:

| Variable | Meaning | Allowed range |
| --- | --- | --- |
| `CHECKOUT_ADMISSION_MAX_CONCURRENT` | Maximum active checkout requests in one runtime process | 1–100 |
| `CHECKOUT_ADMISSION_WINDOW_REQUESTS` | Maximum admitted checkout requests during the rolling window | 1–10,000 |
| `CHECKOUT_ADMISSION_WINDOW_SECONDS` | Rolling-window duration | 1–3,600 seconds |

Missing, non-integer, zero, negative or out-of-range values stop startup. These
are server-only values and must never use a `PUBLIC_` prefix.

Do not treat an example value as an approved production threshold. Select
limits from measured provider, database and runtime capacity, then exercise
legitimate bursts and malicious synthetic traffic in staging.

## Behaviour and limitations

- Only `POST /checkout` consumes admission capacity.
- `GET` and `OPTIONS` retain their normal method/CORS behaviour.
- Rejected requests do not reach order creation, PostgreSQL or Mollie.
- Capacity is released even when the downstream checkout handler fails.
- The rolling-window count includes admitted attempts regardless of outcome.
- A restart clears the in-memory window.
- Each scaled runtime instance maintains its own controller, so the application
  limit is not a globally exact quota.
- No email, address, IP, cookie, fingerprint or other personal identifier is
  retained by this controller.

Because the controller is intentionally privacy-minimised and per-process, the
Cloudflare rule remains the primary distributed abuse boundary before public
launch.

## Staging exercise

Use only the private synthetic checkout fixture and a Mollie test account.

1. Record the source commit, runtime instance count and UTC test interval.
2. Configure deliberately low rehearsal limits and deploy the customer runtime
   with the reviewed test checkout configuration.
3. Confirm one normal synthetic checkout can be admitted.
4. Send a bounded synthetic burst. Confirm excess requests receive `429`, a
   positive `Retry-After` value and the generic busy message.
5. Confirm rejected requests created no order, checkout session or provider
   payment.
6. While checkout is limited, confirm `/health` and `/ready` remain responsive
   and an authenticated Mollie test webhook remains reachable and idempotent.
7. Wait for the rolling window to expire and confirm a normal synthetic request
   is admitted again.
8. Repeat through the Cloudflare-proxied custom hostname after the edge rule is
   configured. Confirm the direct origin cannot bypass the intended production
   boundary.
9. Reconcile all synthetic orders/payments, then restore every commerce and
   route gate to `false` unless continued staging use is explicitly approved.

Do not run an unbounded load test or target a third-party provider beyond the
small number of requests authorised for its sandbox.

### 22–23 September 2026 bounded staging evidence

A controlled staging rehearsal exercised the application and edge boundaries
without submitting a valid checkout payload or intentionally creating a Mollie
payment.

- The customer runtime used rehearsal admission values of 2 concurrent requests,
  4 admitted requests per 10-second rolling window.
- With the application window at 4, four malformed `POST /checkout` requests
  returned normal `400` validation responses and subsequent requests returned
  `429`. After the 10-second window elapsed, a malformed request again reached
  normal application validation and returned `400`, demonstrating recovery.
- To isolate the edge layer, the application rolling-window threshold was
  temporarily raised to 100. Initial edge attempts showed that
  `commerce-staging.cyph1.co.uk` was configured as DNS-only, so the Cloudflare
  rate-limit rule recorded zero matches and did not enforce.
- The staging CNAME was changed to **Proxied**. `/health` remained `200` after
  the change.
- The Cloudflare Free-plan rehearsal rule matched path `/checkout`, grouped by
  IP, and used a threshold of 5 requests in 10 seconds with a 10-second block.
  In the bounded eight-request, one-second-spaced test, requests 1–7 returned
  the application's `400` response and request 8 returned `429`. Cloudflare
  subsequently reported eight matching requests. Distributed edge enforcement
  is not treated as an exact request-count quota.
- A deliberately invalid `POST /webhooks/mollie` request returned
  `{"received":false}`, demonstrating that the checkout-specific edge rule did
  not block the webhook route. This is route-continuity evidence only; it is
  **not** evidence that an authenticated Mollie webhook was processed
  idempotently while checkout was saturated.
- The application rolling-window value was restored to 4 and all temporary
  commerce/payment/fixture gates were restored to the locked disabled baseline.
  Final containment checks returned `200` for `/health` and `/ready`, and
  `404` for `/checkout` and `/webhooks/mollie`.
- `commerce-staging.cyph1.co.uk` remains Cloudflare-proxied and the edge rule
  remains active.
- On 23 September 2026, the native Render subdomain was first verified as a real
  bypass: a direct `GET /health` returned the application's `{"status":"ok"}`
  response. A repository search found no committed dependency on the native
  `.onrender.com` hostname. The Render Subdomain control was then disabled.
  The custom Cloudflare-proxied hostname continued to return `200` for
  `/health`, while the native Render hostname returned `404 Not Found` with
  `x-render-routing: blocked-render-subdomain`. This closes the staging
  direct-origin bypass. The production service must repeat this verification
  before public checkout is enabled.

### 23 September 2026 authenticated webhook-under-saturation evidence

A second bounded staging rehearsal closed the stronger webhook-isolation gate using one synthetic £2 Mollie test payment.

- Checkout remained behind the Cloudflare-proxied custom hostname with the application rehearsal window at four admitted requests per 10 seconds.
- A genuine private-fixture checkout created one £2 Mollie test payment. Mollie reported the payment paid; the protected operations record subsequently showed the order `paid`, payment `captured` for 200 GBP minor units and fulfilment `unfulfilled`.
- During deliberate checkout saturation, admitted malformed checkout attempts returned `500` in this run and subsequent attempts returned `429`. The `500` cause was subsequently traced to malformed structured input reaching checkout fingerprinting before required-field validation; the regression was fixed and verified in staging as described below.
- While checkout was returning `429`, the same existing Mollie payment ID was submitted to `POST /webhooks/mollie`. The Mollie test adapter authenticated the notification by retrieving the referenced payment and refunds from Mollie's API. The endpoint returned `{"received":true}` with HTTP `200`.
- A read-only protected operations check after the duplicate notification remained unchanged: one captured £2 payment, order `paid`, fulfilment `unfulfilled`, no refunds and no fulfilment records. No second payment was created.
- The customer browser confirmation page remained on its non-authoritative pending display even after the protected operations state was paid/captured. Record this as a separate status-page UX/state-refresh investigation; it does not override authoritative provider/database state.

This closes the staging authenticated Mollie webhook-under-checkout-saturation gate. It does not approve production thresholds, production edge configuration or production operational ownership.

After the rehearsal, the locked staging baseline was restored and independently checked through the proxied custom hostname: `/health` and `/ready` returned HTTP `200`, while `POST /checkout` and `POST /webhooks/mollie` returned HTTP `404`. The Cloudflare checkout edge rule remained active and the native Render customer subdomain remained disabled.

### 23 September 2026 malformed-input regression closure

The unexpected malformed-request `500` was reproduced from the rehearsal path and traced to request structure validation occurring too late: a syntactically valid JSON object with a valid idempotency key could reach checkout fingerprinting before required fields and nested address types had been validated. Missing `email` therefore caused an ordinary runtime exception rather than a controlled checkout validation error.

The checkout HTTP boundary was hardened to validate the required request structure and primitive field types before invoking `CheckoutService`. Regression coverage includes an empty object, wrong email and quantity types, a null delivery address and a wrongly typed nested postcode. These malformed inputs are rejected without invoking the checkout service.

After the fix was merged, staging was temporarily enabled using the guarded Mollie-test/private-fixture configuration. A single `POST /checkout` containing `{}` with a valid synthetic idempotency key returned `{"message":"Invalid request."}` with HTTP `400`, replacing the earlier `500` behavior. No valid checkout or payment was submitted for this verification.

The locked staging baseline was then restored. Final containment checks through the proxied custom hostname returned HTTP `200` for `/health` and `/ready`, and HTTP `404` for both `POST /checkout` and `POST /webhooks/mollie`. This closes the malformed-input `500` investigation.

No production threshold is approved by this rehearsal. The low application and
Cloudflare values were selected only to obtain bounded staging evidence.

## Monitoring and response

Monitor aggregate admitted/rejected counts at the edge and application without
logging bodies, addresses, payment details or raw IP addresses in application
events. Alert on a sustained rejection increase, provider rate limiting,
database saturation or unusual order-to-payment ratios.

If legitimate customers are rejected, do not simply raise limits. First check
for abuse, direct-origin bypass, provider degradation and database pressure.
Disable checkout using `COMMERCE-DISABLE-AND-ROLLBACK.md` if integrity or
availability is at risk.

## Launch gates

- [x] Per-process concurrent and rolling-window checkout admission implemented.
- [x] Configuration, saturation, recovery, CORS and failure-release tests added.
- [ ] Approve capacity-based staging thresholds.
- [x] Configure and review a Cloudflare staging checkout edge policy and prove
  bounded enforcement through the proxied custom hostname.
- [x] Remove/restrict the staging direct-origin bypass and verify the proxied
  custom hostname remains healthy. Repeat this control for production before
  public checkout.
- [x] Run bounded staging application and edge burst/recovery tests with
  malformed synthetic requests.
- [x] Verify an authenticated Mollie test webhook remains reachable and
  idempotent during checkout saturation. A genuine Mollie test payment was
  authenticated through provider retrieval, replayed while checkout returned
  `429`, acknowledged with HTTP `200`, and remained one captured payment with
  no fulfilment after the duplicate notification.
- [ ] Assign alert ownership and approve production thresholds.
