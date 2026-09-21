# Worker restart and retry exhaustion

**Status:** Engineering baseline, Render development migration and guarded lease/retry rehearsal complete; real process-interruption and provider-idempotency evidence outstanding  
**Last engineering update:** 21 September 2026

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
It does **not** yet prove recovery after physically interrupting a worker process,
nor that the selected external fulfilment and communication providers honour the
stable idempotency keys. Those remain separate launch gates.

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
- [ ] Run a real worker process-interruption/replacement-worker recovery exercise.
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
