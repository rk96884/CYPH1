# Fulfilment outage and manual-review processing

**Status:** Pre-production engineering baseline; provider selection, sandbox exercise and production approval outstanding

**Scope:** Paid-order handoff, provider creation, fulfilment events, cancellation, returns and recovery

## Safety rules

- Never fulfil an order unless the application records both a paid order and a
  verified captured payment.
- Never create a replacement fulfilment while the original provider request may
  have succeeded.
- Never mark an order dispatched or delivered from an email, customer statement
  or carrier page alone.
- Never repair fulfilment state with ad-hoc database updates or record deletion.

No 3PL or manufacturer fulfilment provider is selected. `manual-test` has no
external side effect and remains the only permitted adapter for controlled
non-production exercises.

## Existing controls

| Control | Behaviour |
| --- | --- |
| `FULFILMENT_MODE=disabled` and `FULFILMENT_PROVIDER=disabled` | No fulfilment dependency can satisfy commerce enablement |
| Verified `payment.paid` outbox event | Only automatic route into fulfilment creation |
| Paid/captured database recheck | Prevents unpaid orders crossing the boundary |
| Stable `fulfilment:<payment-event-key>` idempotency key | Prevents a duplicate reservation and must be honoured by a future provider |
| Three-attempt automatic retry ceiling | Stops repeated provider calls; a failed event then needs a permission-controlled operator retry |
| `fulfilment:retry` permission | Restricts deliberate retry of a failed `payment.paid` event |
| State machine and provider-event identity | Ignores duplicates/stale events and sends unsafe forward transitions to manual review |

An operator retry changes only a failed outbox event back to `pending`. It does
not bypass the paid/captured check or create a new idempotency identity. Before
retrying, the operator must prove whether the provider already accepted the
original request.

## Incident triggers

Start this procedure when any of the following occurs:

- repeated fulfilment creation failures or exhausted automatic attempts;
- provider timeout where creation may have succeeded;
- paid order remains queued/manual review beyond the agreed staging threshold;
- provider reference exists without a matching local fulfilment;
- duplicate dispatch, tracking mismatch or unsafe out-of-order event;
- provider reports an outage, degraded API or delayed event delivery;
- fulfilment advances for an order that is not reconciled as paid/captured;
- cancellation or return state differs between CYPH/1 and the provider.

Treat suspected duplicate dispatch or fulfilment of an unpaid order as critical.

## Immediate containment

1. Record the UTC start time, environment, source commit and safe correlation,
   order, outbox and fulfilment references.
2. Stop the fulfilment worker/consumer or set the fulfilment runtime to its
   disabled configuration. Do not disable payment webhooks or reconciliation
   solely because fulfilment is unavailable.
3. If orders cannot be fulfilled within approved customer commitments, disable
   new checkout using the independent checkout/commerce gates. Do not invent a
   delivery estimate.
4. Confirm no new provider creation calls occur. Preserve paid orders, payment
   webhooks, outbox events and fulfilment/audit history.
5. Check the provider's status and authorised dashboard/API. If credentials or
   data integrity may be compromised, follow the security incident path instead
   of attempting recovery.

## Classify affected work

| Class | Local evidence | Action |
| --- | --- | --- |
| `F-CREATE-UNKNOWN` | Creation failed/timed out; no provider reference locally | Query provider with the original order and idempotency reference; do not retry yet |
| `F-CREATE-ABSENT` | Provider conclusively confirms no fulfilment exists | Retain evidence, then issue one authorised retry of the failed outbox event |
| `F-CREATE-EXISTS` | Provider accepted creation but local reference/state is missing | Do not retry; escalate for an audited reconciliation operation |
| `F-STATE-MISMATCH` | Local and provider status/tracking differ | Keep customer communication and subsequent commands blocked; reconcile authoritative event history |
| `F-MANUAL-REVIEW` | Order is `manual_review` or provider transition requires review | Assign an owner and next-review time; do not force a state transition |
| `F-DUPLICATE` | More than one provider fulfilment/dispatch for one order | Stop processing, contact provider and escalate urgently |
| `F-UNPAID` | Provider fulfilment exists without a verified captured local payment | Stop/cancel fulfilment where safely possible and escalate urgently |

The current operations API can deliberately requeue only a failed
`payment.paid` outbox event. It does not force-resolve provider references or
fulfilment state. Those gaps require an audited application operation before
production—not direct SQL.

## Authorised retry

Use an operator with `fulfilment:retry` only after the incident owner records
that the provider did not accept the original request:

1. Inspect the order timeline, captured payment, fulfilment reservation,
   outbox attempt count and last safe failure code.
2. Record the provider evidence establishing `F-CREATE-ABSENT`.
3. Submit one retry with a new operator-command idempotency key. The underlying
   provider request retains the original stable fulfilment idempotency key.
4. Observe the outbox and provider result. Do not submit a second operator retry
   while the first is pending or ambiguous.
5. If it fails or becomes ambiguous again, return it to manual review and
   escalate rather than looping.

The three-attempt ceiling applies to automatic retries. A deliberate operator
retry remains possible after exhaustion, but every retry is recorded and must
be separately justified.

## Provider events and state mismatch

1. Authenticate the event through the future reviewed provider adapter and
   match its provider event/reference identity.
2. Allow exact duplicates and stale backwards events to be ignored
   idempotently.
3. Treat an unsupported forward transition as manual review. Never skip states
   by overwriting the local status.
4. Accept tracking carrier/reference only through an authenticated adapter event.
5. Do not send dispatch/delivery communication until the local transition and
   outbox/communication record are consistent.

## Cancellation and returns

- Automatic cancellation is permitted only before dispatch.
- A return request is permitted only after dispatch.
- A provider timeout makes the command ambiguous. Reconcile the original stable
  command key before issuing another request.
- A cancelled or returned fulfilment does not prove that a payment refund was
  completed. Reconcile refunds separately.
- Product-specific return routing, warranty handling and customer commitments
  remain unapproved until the device and fulfilment model are final.

## Recovery and re-enable

1. Confirm the provider reports recovery and authorised access is intact.
2. Reconcile every paid order/outbox/fulfilment created from 15 minutes before
   the incident through 15 minutes after recovery. Expand the window if needed.
3. Confirm every provider fulfilment has one local order and one stable
   fulfilment record, with matching SKU quantities and destination country.
4. Confirm there are no unexplained failed/processing outbox events, missing
   provider references, duplicate dispatches, unpaid fulfilments or manual-review
   orders.
5. Process approved retries one at a time and verify the resulting provider
   reference/state before continuing.
6. Re-enable the fulfilment worker only after the incident owner approves the
   reconciliation. Re-enable checkout separately if it was contained.

## Privacy-safe evidence

Record UTC times, environment, commit, incident owner role, provider status
reference, non-personal order/outbox/fulfilment IDs, attempt counts, exception
class, resolution decision and final gate state.

Do not place names, emails, phone numbers, addresses, tracking references, API
keys, access assertions, request snapshots or provider payloads in GitHub,
screenshots or source-controlled evidence.

## Required sandbox exercise

After a real fulfilment provider is selected and its sandbox/security review is
complete:

1. Confirm a verified synthetic paid event creates exactly one fulfilment.
2. Force repeated provider creation failures and confirm automatic attempts stop
   at three.
3. Prove an operator retry requires `fulfilment:retry`, preserves provider
   idempotency and is recorded once.
4. Send duplicate, stale and unsafe forward events; confirm duplicates/stale
   events are ignored and unsafe transitions enter manual review.
5. Exercise pre-dispatch cancellation and post-dispatch return separately.
6. Reconcile all synthetic records and restore fulfilment/commerce gates to
   their disabled values.

Until then, equivalent tests may use `manual-test`, but they do not validate a
future provider's API, idempotency, privacy, webhook or recovery behaviour.
