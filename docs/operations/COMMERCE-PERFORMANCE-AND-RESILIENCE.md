# Commerce performance and resilience baseline

**Status:** Read-only engineering harness and first staging probe complete  
**Last engineering update:** 7 September 2026

## Purpose

Establish a bounded, repeatable staging performance signal without creating
orders, processing personal data or contacting a payment or fulfilment provider.
This baseline is not a production capacity claim and is not a checkout load
test.

## Read-only probe

`scripts/check-commerce-staging-load.mjs` alternates between `GET /health` and
`GET /ready`. It requires exact generic JSON responses, rejects redirects, uses
per-request timeouts and reports request count, peak concurrency, p50, p95 and
maximum latency.

The harness cannot request arbitrary paths or methods. Its hard limits are:

- 2–200 total requests;
- 1–10 concurrent requests;
- 250–30,000 milliseconds per-request timeout;
- a required explicit confirmation value of `synthetic-read-only`.

No response body, credential, assertion, address, email, order identifier or raw
request trace is printed or retained.

## Local safeguard test

```powershell
npm run test:staging-load
```

The unit tests prove fail-closed configuration, the request and concurrency
bounds, exact-response validation and p95 threshold enforcement. CI runs these
tests without contacting staging.

## Controlled staging run

Use the direct customer-staging Render origin so the result measures the runtime
rather than Cloudflare Access. Confirm the service is intended for this exercise
and contains only synthetic test data.

```powershell
$env:COMMERCE_LOAD_CONFIRM = "synthetic-read-only"
$env:COMMERCE_LOAD_ORIGIN = "https://cyph1-commerce-customer-staging.onrender.com"
$env:COMMERCE_LOAD_REQUESTS = "40"
$env:COMMERCE_LOAD_CONCURRENCY = "4"
$env:COMMERCE_LOAD_TIMEOUT_MS = "5000"
$env:COMMERCE_LOAD_MAXIMUM_P95_MS = "2000"
npm run probe:staging-load
Remove-Item Env:COMMERCE_LOAD_CONFIRM
Remove-Item Env:COMMERCE_LOAD_ORIGIN
Remove-Item Env:COMMERCE_LOAD_REQUESTS
Remove-Item Env:COMMERCE_LOAD_CONCURRENCY
Remove-Item Env:COMMERCE_LOAD_TIMEOUT_MS
Remove-Item Env:COMMERCE_LOAD_MAXIMUM_P95_MS
```

Record the commit, UTC interval, Render instance type and probe summary. Stop if
Render, PostgreSQL or the monitor reports degradation. Do not increase the hard
limits or point this tool at checkout, operations, webhooks or third parties.

## Acceptance criteria

- all responses exactly match the expected `200` health/readiness bodies;
- no timeout, redirect, transport or parsing failures occur;
- measured p95 does not exceed the explicitly recorded threshold;
- Render and PostgreSQL show no sustained resource or connection saturation;
- the next scheduled staging monitor remains healthy.

A first run may include cold-start latency. If it fails, retain both cold and
warm results rather than concealing the cold start, then decide whether the
service plan and availability expectations are acceptable.

## Bounded checkout admission probe

`scripts/check-checkout-admission-capacity.mjs` provides a deliberately narrow
pre-provider measurement for the checkout HTTP/admission boundary. It sends only
malformed synthetic `{}` bodies with unique synthetic idempotency keys. The
request is rejected by structural validation before order creation, PostgreSQL
checkout writes or Mollie payment creation. Expected responses are only the
normal validation `400` or admission-control `429` with a positive
`Retry-After`.

The probe fails closed unless `CHECKOUT_PROBE_CONFIRM` is exactly
`synthetic-malformed-no-payment`. It is hard-limited to 40 requests and
concurrency 5. It cannot establish database or payment-provider transaction
capacity and therefore must not, by itself, be used to approve a production
checkout threshold.

Use it only during an explicitly enabled guarded staging window, with the
configured private storefront origin. Record the application admission values,
Cloudflare rule, request counts, response split, latency, runtime resources and
post-test containment.

## Checkout admission staging evidence — 23 September 2026

A bounded malformed-request exercise measured the two existing staging abuse
boundaries without creating an order or Mollie payment.

The initial edge-inclusive run used application admission values of maximum
concurrency 2 and 4 requests per 10 seconds, with Cloudflare at 5 requests per
10 seconds / 10-second block. Twelve requests at concurrency 2 produced 4
validation `400` responses, 2 application `429` responses and 6 Cloudflare
edge `429` responses, with p50 80 ms, p95 506 ms and maximum 506 ms. A
six-request diagnostic separately showed requests 1–4 returning validation
`400`, request 5 returning the application busy `429`, and request 6 being
blocked by Cloudflare with error 1015.

For isolation, Cloudflare was temporarily raised to 20 requests per 10 seconds
while the application remained at maximum concurrency 2 and 4 requests per 10
seconds. After the windows cleared, the same 12-request/concurrency-2 probe
returned exactly 4 validation `400`, 8 application `429`, 0 edge `429`, no
unexpected responses, p50 74 ms, p95 315 ms and maximum 315 ms. This demonstrates
the configured application rolling-window boundary independently of Cloudflare.

Cloudflare was then restored to the staging rehearsal value of 5 requests per
10 seconds with a 10-second block. The application values remained maximum
concurrency 2, 4 requests per 10 seconds and a 10-second window.

These results validate enforcement of the deliberately low staging limits. They
do **not** establish database, Mollie or end-to-end production checkout capacity
and do not approve production thresholds.

## Deferred capacity work

Checkout performance requires separate approval because it creates database
and Mollie sandbox state. Before launch, run the bounded synthetic exercise in
`CHECKOUT-ABUSE-AND-RATE-LIMITING.md`, verify webhook continuity, reconcile all
test records and derive thresholds from the selected production service plan.

Longer soak tests, Cloudflare edge measurements, database saturation/recovery,
multi-instance behaviour and production objectives also remain launch gates.

## Evidence record

| Field | Record |
| --- | --- |
| Reviewer | Project owner |
| Commit | Pre-commit working tree based on `c90ac74`; resulting implementation commit is identified by repository history |
| UTC interval | 7 September 2026; exact UTC time was not captured |
| Target environment | Customer staging direct Render origin |
| Render instance type | Existing customer-staging instance; confirm plan and resources when interpreting capacity |
| Request/concurrency settings | 40 requests; concurrency 4; timeout 5,000 ms; maximum p95 2,000 ms |
| Probe summary | Passed with zero invalid responses: peak concurrency 4; p50 63 ms; p95 198 ms; maximum 240 ms |
| Render/PostgreSQL observations | No failure was exposed by the exact health/readiness responses; provider resource graphs were not captured |
| Follow-up | GitHub Actions **Commerce staging monitor** run #50 passed after the probe against `c90ac74`; retain checkout/provider load, resource evidence and capacity approval as separate gates |
