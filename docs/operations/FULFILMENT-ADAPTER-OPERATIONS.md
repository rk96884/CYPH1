# Fulfilment adapter operations

## Current status

The Milestone 3.1 boundary is implemented but production fulfilment is not
enabled. No 3PL has been selected or approved and no customer data is sent to
an external fulfilment service.

Defaults remain:

```text
FULFILMENT_MODE=disabled
FULFILMENT_PROVIDER=disabled
```

`manual-test` is a non-production adapter with no external side effect. It may
only be selected together with `FULFILMENT_MODE=test` in a private integration
environment.

## Safety invariants

- A verified `payment.paid` outbox event is the only automatic trigger.
- The consumer re-reads the order and requires both `orders.status = 'paid'`
  and a captured payment before reserving fulfilment.
- Fulfilment requests and provider events use database uniqueness constraints
  for idempotency.
- Failed creation or invalid forward state changes route the order to
  `manual_review`.
- Cancellation is permitted only before dispatch. Returns are permitted only
  after dispatch.
- Tracking details are accepted only through an adapter event and are audited.

## Render development migration

Set `DATABASE_URL` and `DATABASE_SSL` temporarily in the local PowerShell
session, then run:

```powershell
npm run db:migrate
npm run db:migrate
npm run db:verify
```

The expected result is migration `0005_fulfilment_processing.sql`, followed by
an up-to-date result and verification of 21 required tables. Remove the two
temporary environment variables from the shell afterwards.

Do not enable the fulfilment consumer in production until a provider-specific
security, privacy, retry and operational review is approved.
