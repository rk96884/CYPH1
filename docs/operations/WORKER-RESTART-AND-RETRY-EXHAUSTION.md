# Worker restart and retry exhaustion

**Status:** Engineering baseline and Render development migration complete; managed rehearsal outstanding  
**Last engineering update:** 8 September 2026

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

## Deferred managed rehearsal

Use synthetic records and no live provider. Start a worker claim, stop the
worker before completion, wait for the configured lease, and start a replacement
worker. Verify the same durable job is reclaimed, the stable provider key is
reused, and exactly one fulfilment/message effect is recorded. Repeat through
the final permitted attempt and verify the job becomes terminal `failed` and is
visible for accountable manual review.

Do not shorten production leases, manipulate real order rows, or repeatedly
restart a worker to manufacture attempts. Manual replay must remain permission
controlled and audited.

## Launch gates

- [x] Durable lease columns and bounded defaults implemented.
- [x] Stale claims below the limit are eligible for recovery.
- [x] Expired claims at the limit become terminal failures.
- [x] Completion and failure clear claim timestamps.
- [x] Apply and verify migration `0010` on Render development PostgreSQL.
- [ ] Run a managed restart/reclaim/exhaustion rehearsal with synthetic data.
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
