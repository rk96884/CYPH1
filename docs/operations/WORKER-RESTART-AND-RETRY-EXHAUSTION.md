# Worker restart and retry exhaustion

**Status:** Engineering baseline, lease/retry rehearsal and real process-interruption rehearsal complete locally and on Render development; provider-idempotency and alert ownership remain outstanding  
**Last engineering update:** 22 September 2026

## Purpose

Ensure a fulfilment or transactional-communication worker crash cannot leave a
job permanently stuck in `processing`, while preventing endless automatic
retries or duplicate business effects.

## Claim contract

- A claim increments `attempt_count` and records `processing_started_at`.
- A completed or explicitly failed attempt clears the claim timestamp.
- A `processing` claim older than the five-minute default lease can be reclaimed
  only while its attempt count is below the automatic retry limit.
- An expired claim at the retry limit is moved to terminal `failed` with the
  bounded code `retry_exhausted`.
- Defaults are three attempts and a 300-second lease. Code rejects retry limits
  outside 1–10 and leases outside 30–3,600 seconds.
- Fulfilment and communication provider requests retain stable idempotency keys.
  A real provider must honour those keys before restart recovery is approved.

Migration `0010_worker_claim_leases.sql` adds the lease timestamps. Any legacy
row already in `processing` during migration is reset to retryable `failed` with
`worker_restart_recovery`; it is not silently marked successful.

## Verification

```powershell
npm run test:commerce
npm run db:migrate
npm run db:migrate
npm run db:verify
```

The second migration run must report that the schema is current. Verification
must report the worker claim lease columns. Use the existing Render development
database credentials only in the current PowerShell process and remove them
afterwards.

## Guarded database rehearsal

On 21 September 2026, the guarded synthetic rehearsal passed first against an
isolated local PostgreSQL 17 database and then against Render development
PostgreSQL. For both fulfilment and transactional communications it verified
active-lease protection, stale-claim recovery and terminal `retry_exhausted`
behaviour at three attempts. The rehearsal used a 30-second test lease and
safely aged only its own synthetic claim timestamps rather than waiting for wall
clock expiry. All synthetic records were enclosed in a transaction and rolled
back; the local cleanup query confirmed zero synthetic customer records remained.

The Render-development run used the same guarded harness and no live payment,
fulfilment or communication provider calls. Database credentials were removed
from the local PowerShell environment after the run.

This evidence validates the PostgreSQL lease/reclaim/retry-exhaustion contract.

## Real process-interruption rehearsal

On 22 September 2026, a guarded rehearsal passed against an isolated local
PostgreSQL 17 database using a real child worker process. The worker durably
claimed a synthetic `payment.paid` outbox event and was then forcibly terminated
before completion. The claim remained `processing`; an immediate replacement
claim was rejected while the lease was valid. The harness then aged only its own
synthetic claim beyond the 30-second test lease and verified that a replacement
claim recovered the same durable event on attempt two.

The event key was unchanged across the interruption, so the fulfilment request
would retain the same `fulfilment:<event-key>` provider idempotency key. No
external payment, fulfilment or communication provider was called. The harness
removed its synthetic records and the isolated local rehearsal database was
dropped after the run.

The same guarded real-process rehearsal also passed against Render development PostgreSQL on 22 September 2026. A real child process durably claimed the synthetic job before forced termination; reclaim remained blocked before lease expiry; after the harness aged only its own synthetic claim beyond the test lease, the same durable job was reclaimed on the next attempt with the same event key and CYPH/1 fulfilment idempotency key. No external provider call was made.

This proves recovery after physically interrupting the worker process against both the isolated local and managed Render development databases, plus stable CYPH/1-side fulfilment idempotency-key derivation. It does **not** prove that a selected external provider honours that key. Provider-side idempotency remains a separate launch gate.

Do not shorten production leases, manipulate real order rows, or repeatedly
restart a worker to manufacture attempts. Manual replay must remain permission
controlled and audited.

## Launch gates

- [x] Durable lease columns and bounded defaults implemented.
- [x] Stale claims below the limit are eligible for recovery.
- [x] Expired claims at the limit become terminal failures.
- [x] Completion and failure clear claim timestamps.
- [x] Apply and verify migration `0010` on Render development PostgreSQL.
- [x] Run the guarded synthetic database lease/reclaim/exhaustion rehearsal locally and on Render development.
- [x] Run a guarded real worker process-interruption/replacement-worker recovery exercise locally.
- [x] Repeat the guarded real process-interruption exercise against Render development.
- [ ] Verify the selected fulfilment and communication providers honour stable
      idempotency keys.
- [ ] Assign ownership and alerting for terminal failures.

## Development migration evidence

On 8 September 2026, the project owner applied
`0010_worker_claim_leases.sql` to Render development PostgreSQL. A second
migration run reported the schema current at ten migrations, and schema
verification confirmed both worker claim lease columns before rolling back its
test records. No database credential or personal data is retained in this
record.
