# Fulfilment outbox claim-token fencing

This change adds a **unique UUID claim token** each time a payment outbox event is claimed. Completion of `published` or `failed` now requires that the same token still owns the event in `processing`. A stale worker attempting completion raises `fulfilment_claim_lost`. A completion failure is **not** converted into an additional failed-status write. Claim retry limits (3 default), five-minute retry delay, and the existing lease (300 seconds default) remain unchanged.

## Schema dependency and rollout
The consumer now depends on a new nullable `outbox_events.claim_token uuid` column. SQL preparation is in `apps/commerce-api/sql/fulfilment-outbox-claim-fencing.sql`; **not executed automatically**. Prior to any deployment, validate that the migration applies cleanly to the appropriate development database, then plan the production migration separately under owner authorization. Do not deploy code before the column exists. No production migrations or consumers have been activated.

## Concurrency/crash limitations
- `SELECT ... FOR UPDATE SKIP LOCKED` prevents two simultaneous transactions claiming the same pending row.
- A claim that passes its lease can be reclaimed; old worker completions cannot overwrite the new claim token. Retry exhaustion follows existing logic.
- **Important:** fencing database completion is not sufficient to guarantee exactly-once provider-side effects. A crash after `requestForPaidOrder` but before `finish` can leave an outbox item to retry. Reservation keys reduce duplicate creation risk, but recovery around ambiguous external side effects still needs end-to-end integration validation.
- Synthetic mock tests are not a substitute for PostgreSQL integration tests of row locks, lease expiry, retry exhaustion and crash/duplicate-provider scenarios.

This PR does not add Cron, connect a live Cloudflare entrypoint, enable payment or fulfilment, or modify production state. CYPH/1 K-803 product-safety evidence and final owner GO/NO-GO remain mandatory before enabling commerce.
