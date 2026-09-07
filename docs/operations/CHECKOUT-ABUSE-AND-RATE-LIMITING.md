# Checkout abuse and rate limiting

**Status:** Application engineering baseline; edge policy and load evidence outstanding  
**Last engineering update:** 7 September 2026

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
   launch so an attacker cannot bypass the Cloudflare policy. The current direct
   origin remains enabled for staging operations and therefore is not an
   adequate production edge boundary.
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
- [ ] Configure and review the Cloudflare checkout-only edge policy.
- [ ] Remove or restrict direct-origin bypass before public checkout.
- [ ] Run bounded staging burst and recovery tests with synthetic data.
- [ ] Verify webhook continuity during checkout saturation.
- [ ] Assign alert ownership and approve production thresholds.
