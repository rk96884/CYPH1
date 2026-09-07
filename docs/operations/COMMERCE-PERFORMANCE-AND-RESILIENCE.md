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
