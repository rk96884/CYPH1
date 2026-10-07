# Fulfilment adapter operations

## Current status

The fulfilment boundary and protected manual dispatch slice are implemented, but production fulfilment is not
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
- Tracking details enter through an adapter event or a protected manual command; both use the same transactional event/state writer and are audited.

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

Failure containment, bounded retry and manual-review decisions are defined in
`FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`.

## Initial launch: manual home delivery

Planning-approved customer proposition: Standard UK Delivery — £3.99,
tracked to the customer's address, additional to the £74.99 product price.
Royal Mail Tracked 48 is preferred/default; Evri, DPD and InPost Home Delivery
are operational alternatives subject to approval. Do not promise a carrier or
offer a locker/collection-point option. No carrier API/label automation is
required for approximately 20 units.

The project owner confirms K-803 is mains powered with no internal battery.
Retail box 32 × 24 × 12 cm and sample under 1 kg do not establish the final
customer-ready packed parcel. Verify final packed dimensions/weight, current
carrier rates/service/eligibility and retain compensation/claims terms before
GO-01. £3.99 is not configured for live checkout.

## Protected packing and manual dispatch

- GET /operations/orders/:id/packing requires fulfilment:read; orders:read
  alone does not disclose the packing address. Responses are no-store and
  successful reads record the authenticated operator without address data
  in the audit summary.
- POST /operations/orders/:id/dispatch requires fulfilment:dispatch and a
  stable Idempotency-Key. Body: fulfilmentId, carrier, service,
  trackingReference, optional trackingUrl and handoverConfirmed: true.
- Manual mutation remains disabled by default. It requires an explicitly
  configured manual-test/test or manual-live/live fulfilment pairing.
  Production enablement remains subject to GO-01.
- The order must be paid, have one full-value/currency-matching captured
  payment, no blocking refund/dispute activity, processing fulfilment status
  and exactly one accepted manual fulfilment. Existing fulfilment preparation
  remains separate; this command does not create another shipment.
- Carrier/service are neutral text values. Tracking reference is required.
  Optional tracking URLs must pass public HTTPS syntax validation; this is
  not proof the link belongs to the named carrier. Verify the actual booking
  record before entry. No carrier-derived URLs or external URL fetching.
- The existing state machine and shared writer persist dispatch, tracking
  metadata, timestamp, named operator, handover confirmation, one event and
  outbox entry atomically with the operator-command result.
- Same-key/same-operator/same-payload retries replay the result. Changed
  payload/operator key reuse conflicts. Different-key duplicate dispatch
  conflicts after locking and rechecking authoritative state.

Operator workflow:
1. Find the order and load restricted packing information.
2. Verify captured payment, items, quantities and delivery address.
3. Pick/pack and manually purchase the approved carrier service.
4. Physically hand over/drop off the parcel. Label purchase alone is not dispatch.
5. Enter carrier, service, tracking reference and actual HTTPS link if available.
6. Tick physical handover confirmation, review the displayed details and
   explicitly confirm dispatch.
7. Check resulting fulfilment state/timeline. Dispatch email is processed
   separately by the existing communication consumer; recorded dispatch
   does not prove email delivery.
8. Retain booking/handover/label evidence only in approved restricted storage
   under the approved retention schedule, never Git or general logs.

Missing URL is permitted; carrier/reference are retained and the existing
email omits its tracking link. Public UUID status remains coarse payment
state only; addresses and tracking are not added to that endpoint.

## Deployment and rehearsal still required

Apply migration 0016_manual_dispatch.sql through the migration runner in an
approved environment, verify schema, grant named operators only necessary
permissions and test Cloudflare Access denial/allow behaviour. No production
migration or grant is performed by this implementation.

Fulfilment consumer scheduling/preparation and live transactional provider/
worker configuration remain separate release tasks. Rehearse real carrier
booking/handover, missing URL, duplicates, concurrent commands, refund
conflicts, failed persistence, uncertain response and email failure/retry.
Local synthetic PostgreSQL tests are engineering evidence, not carrier or
production approval. SH-01/SH-02/EM-01/OPS-01/QA-01/GO-01 remain open.

Run real database regressions only against a disposable local database named
*_dispatch_test with MANUAL_DISPATCH_TEST_DATABASE_URL set, then run
npm run test:commerce. The tests create/drop an isolated generated schema;
without that variable the database integration case is skipped.
