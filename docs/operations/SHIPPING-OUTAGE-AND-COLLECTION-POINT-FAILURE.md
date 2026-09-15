# Shipping outage and collection-point failure

**Status:** Provider-neutral operating baseline; provider exercise and production approval outstanding  
**Production commerce:** Disabled  
**Last engineering update:** 15 September 2026

## Purpose and scope

Define safe customer and operational behaviour when home or **Locker /
Collection Point** delivery cannot be quoted, selected, booked, labelled or
tracked.

This runbook covers the storefront, commerce API, shipping aggregator, carrier,
collection-point directory, shipment booking, labels, tracking and
return-to-sender. It complements the fulfilment outage procedure; it does not
approve a provider, customer promise, refund, replacement dispatch or live
configuration change.

## Safety rules

- Never silently replace the customer's confirmed carrier, delivery type or
  collection point.
- Never create a second shipment while an earlier booking may have succeeded.
- Never treat a provider timeout, missing label or missing webhook as proof
  that no shipment exists.
- Never mark an order dispatched, ready for collection, delivered or returned
  from an unauthenticated message or customer report alone.
- Never change the paid delivery charge because the provider's cost changed
  after checkout.
- Never expose provider credentials, labels, barcodes, collection codes,
  addresses or full tracking references in logs, alerts or public incidents.
- Preserve home delivery when it is independently healthy and operationally
  approved; disable only the affected proposition/service where controls allow.
- Disable new checkout if no approved delivery proposition can meet the
  customer promise.

## Required controls before production

The eventual implementation must support independently reversible gates for:

- collection-point search/selection;
- each shipping provider adapter;
- each carrier service or delivery proposition;
- shipment booking/label creation; and
- tracking webhook ingestion.

Turning off new collection-point selection must not delete existing selections,
cancel shipments or block authenticated tracking for in-flight parcels.
Turning off new shipment booking must preserve payment webhooks, order evidence
and reconciliation.

The exact flag names and control surface remain an implementation decision.
Provider-dashboard changes alone are not a safe substitute for server-owned
gates.

## Signals and severity

| Level | Examples | Initial response |
| --- | --- | --- |
| Low | One point search returns no suitable locations; one invalid customer query | Offer another search or approved home delivery; do not open a provider incident |
| Medium | Repeated point-directory errors, stale opening details, isolated label failure or delayed tracking | Contain the affected workflow, assign investigation and monitor scope |
| High | Collection-point selection broadly unavailable, repeated booking ambiguity, carrier outage, widespread label failure or uncollected-parcel mismatch | Disable the affected proposition/provider; reconcile all work in the incident window |
| Critical | Duplicate shipments, dispatch to the wrong point, exposed label/code, forged webhook accepted, shipment for an unpaid order or suspected credential compromise | Stop affected booking immediately and follow security/privacy/commerce incident escalation |

Customer inconvenience alone does not determine severity. A single wrong-point
dispatch or exposed collection code may be more serious than a broad but safely
failed search outage.

## Failure classification

| Code | Condition | Safe disposition |
| --- | --- | --- |
| `S-SEARCH-NONE` | Search succeeds but no eligible points meet parcel/location constraints | Let customer change search or choose approved home delivery |
| `S-SEARCH-UNAVAILABLE` | Directory/aggregator fails, times out or returns invalid data | Stop point selection; do not use stale data as current availability |
| `S-POINT-STALE` | Chosen point is removed, closed, full or no longer supports the parcel/service | Require reselection before payment/booking |
| `S-POINT-MISMATCH` | Provider response differs from customer-confirmed point/carrier/type | Block booking and investigate; never substitute silently |
| `S-QUOTE-UNAVAILABLE` | No approved proposition/rate is available for the parcel/destination | Do not permit checkout submission |
| `S-BOOKING-UNKNOWN` | Booking timed out or failed without proof of absence | Reconcile by idempotency/order reference; do not retry |
| `S-BOOKING-ABSENT` | Provider conclusively confirms no shipment exists | One authorised retry using the original stable booking identity |
| `S-BOOKING-EXISTS` | Provider accepted booking but local reference/state is missing | Do not retry; use audited reconciliation/manual review |
| `S-LABEL-UNAVAILABLE` | Shipment exists but label/QR retrieval fails | Hold dispatch, preserve shipment and retry retrieval safely |
| `S-TRACKING-DELAYED` | No authenticated event within the approved expectation | Query/reconcile provider; do not infer state |
| `S-TRACKING-MISMATCH` | Local/provider route, destination or status conflicts | Block dependent communications/actions and escalate |
| `S-UNCOLLECTED` | Collection window expires or carrier initiates return | Authenticate event, notify under approved wording and track RTS separately |
| `S-DUPLICATE` | More than one booked/handed-over shipment for one intended attempt | Stop affected processing and escalate urgently |
| `S-WRONG-DESTINATION` | Shipment booked or moving to a point/address the customer did not confirm | Critical containment, carrier intercept where safe and customer/privacy review |

## Customer-facing behaviour

### Search returns no suitable point

1. State that no suitable Locker/Collection Point is currently available for
   that search and parcel; do not imply the whole carrier network is down.
2. Allow postcode correction or a broader approved search.
3. Offer Standard Home Delivery only if it is independently eligible, correctly
   priced and within the approved promise.
4. Preserve basket contents but do not preserve raw search coordinates/history.

### Selector or point-directory failure

1. Show a concise temporary-unavailability message with keyboard focus placed
   on it.
2. Keep entered checkout data where safely possible without confirming a point.
3. Offer retry and independently healthy home delivery.
4. Do not present cached points as currently selectable unless the provider
   explicitly supports safe validation and the server revalidates before
   confirmation.
5. If failures cross the agreed threshold, remove/disable the collection-point
   proposition for new attempts.

### Selected point becomes unavailable

- Before payment: invalidate the selection and require reselection or a newly
  quoted home method.
- After payment but before booking: place the order in delivery review; contact
  the customer through the approved transactional channel. Do not choose a new
  point for them.
- After booking: do not rewrite the order snapshot. Follow authenticated carrier
  redirection/return evidence and record any customer-approved change as a new
  audited operational decision.

### Generic proposition disclosure

Even when checkout says **Locker / Collection Point**, show the actual carrier,
point name and address before final submission. A fallback must not downgrade
to another carrier, point or home delivery without renewed customer confirmation
where the destination or material promise changes.

## Immediate operational containment

1. Record UTC start time, environment, deployed commit, affected proposition,
   provider/carrier and safe internal correlation/shipment references.
2. Determine whether the fault affects search, quote, booking, label, tracking,
   one carrier or the aggregator as a whole.
3. Disable the narrowest affected new-work path. Preserve authenticated events
   and reconciliation for existing shipments unless their integrity is suspect.
4. If every approved delivery option is affected, disable new checkout using
   the independent commerce/checkout gates.
5. Confirm no new calls occur through the disabled path and no customer is shown
   a choice that cannot be honoured.
6. Preserve immutable order selections, booking reservations, provider events,
   audit history and privacy-safe monitoring evidence.
7. Check the provider's authorised status/dashboard and restricted support
   route. If credential, label or destination integrity is uncertain, begin the
   security/privacy incident path.

Do not disable the website, payment webhook ingestion or an unaffected shipping
proposition merely because one point service is unavailable.

## Ambiguous shipment booking

1. Locate the booking reservation using the internal shipment ID, original
   idempotency key, order reference and bounded UTC window.
2. Query the provider/aggregator using the supported idempotency or merchant
   reference lookup. A dashboard search is evidence for investigation, not by
   itself authority to rewrite local state.
3. If a matching shipment exists, classify `S-BOOKING-EXISTS`; do not create
   another. Reconcile its provider reference through an audited application
   operation.
4. If the provider conclusively confirms absence, classify `S-BOOKING-ABSENT`
   and allow one authorised retry with the same booking intent and stable
   idempotency evidence.
5. If existence remains uncertain, retain `S-BOOKING-UNKNOWN`, hold dispatch
   and escalation. Time passing is not proof of absence.
6. Treat multiple matches as `S-DUPLICATE` and stop affected processing.

## Label or QR failure

- A booked shipment without a retrievable label remains booked; do not rebook
  it to obtain another label.
- Retry label retrieval only through the provider's documented safe operation.
- Verify the label belongs to the intended internal shipment, carrier service
  and confirmed destination before printing or presenting it.
- Keep label content and access links out of ordinary logs, tickets and incident
  records.
- If the parcel was handed over with an incorrect or exposed label/code, stop
  further handling where possible and escalate as a security/privacy event.

## Tracking and notification failure

1. Check webhook verification/deduplication health separately from carrier
   movement.
2. Reconcile the provider's authenticated tracking history for the affected
   window; never manufacture events.
3. Apply only allowed normalized transitions. Store an unsupported conflict for
   manual review rather than skipping states.
4. Suppress duplicate CYPH/1 communications when delayed/replayed events arrive.
5. Do not promise delivery, collection readiness, loss, return or refund based
   only on a missing event.
6. If carrier notifications continue while CYPH/1 tracking is delayed, support
   may acknowledge that fact but must not copy codes or personal tracking detail
   into an unrestricted case.

## Uncollected parcel and return-to-sender

1. Use the authenticated expiry/return event and original shipment reference.
2. Keep the original order delivery-selection snapshot unchanged.
3. Create or associate the carrier's return-to-sender tracking reference where
   supplied; do not mark the customer return, order refund and RTS as the same
   state.
4. Inform the customer using approved wording and do not promise automatic
   redispatch or refund before the parcel and payment/returns position is
   reconciled.
5. Rebooking to the same or a new point is a new customer-approved shipment
   decision, not a retry of the original movement.
6. Record return fees and claims separately from the customer delivery charge.

## Provider and carrier routing during an outage

The generic proposition does not authorise invisible carrier substitution.
Routing an unconfirmed quote to another eligible carrier may be allowed where
the customer is shown the actual carrier, point, price and promise before final
submission. After confirmation/payment, switch only with renewed customer
approval if carrier, point, price or material delivery terms change.

Do not activate an unvalidated backup carrier during an incident. Its product
acceptance, compensation, rates, data processing, API/security and operational
ownership must already have passed launch gates.

## Recovery and re-enable

1. Confirm the provider reports recovery and credentials/integration integrity
   remain trusted.
2. Verify point search, eligibility, quote, booking, label retrieval and
   authenticated tracking separately with synthetic data.
3. Reconcile every selection, booking reservation, shipment and event from at
   least 15 minutes before the first failure through 15 minutes after recovery;
   expand the window where provider delay or clock uncertainty requires it.
4. Resolve or assign every unknown/duplicate/mismatch/manual-review record.
5. Confirm no shipment is tied to an unpaid order, wrong destination or
   unexplained provider reference.
6. Confirm customer-facing methods, prices and fallback messages match the
   enabled server state.
7. Re-enable one provider/proposition at a time after incident-owner approval.
8. Monitor an agreed observation window and retain privacy-safe closure evidence.

Provider status “operational” is necessary but not sufficient for re-enable.

## Privacy-safe evidence

Record:

- UTC detection, containment, provider recovery, reconciliation and re-enable
  times;
- environment, source commit and accountable roles;
- affected proposition/provider/carrier and safe status/support reference;
- internal order/selection/shipment IDs, idempotency identity and counts by
  failure class;
- gate changes, decisions, unresolved work and next review time; and
- synthetic verification results.

Do not record customer names, emails, mobile numbers, addresses, search
postcodes/coordinates, point/pickup codes, labels, full tracking numbers,
provider credentials, webhook signatures/bodies or proof-of-delivery material
in source control or unrestricted incident channels.

## Required exercises after provider selection

Use synthetic orders and the approved sandbox/test environment:

1. Return no suitable points and verify accessible retry/home alternatives.
2. Fail the point directory and prove collection-point selection disables
   without disabling independently healthy home delivery.
3. Make a selected point stale before payment and before booking; require
   reselection in both cases.
4. Simulate an ambiguous booking timeout where a shipment exists and prove no
   duplicate is created.
5. Simulate conclusively absent booking and exercise one authorised retry.
6. Fail label retrieval after booking and prove no replacement shipment is
   created.
7. Send forged, duplicate, delayed, stale and out-of-order tracking events.
8. Exercise collection expiry and return-to-sender independently from refund
   and customer-return states.
9. Simulate aggregator outage with one pre-approved direct/alternate service,
   if such a path exists; verify no unapproved automatic substitution.
10. Reconcile all records, restore disabled/test gates and record privacy-safe
    evidence.

Until a provider is selected, a mock exercise may validate decision flow but
cannot validate provider idempotency, point availability, labels, events,
notifications or recovery.

## Launch gates

- [ ] Independent service/proposition controls implemented and reviewed.
- [ ] Customer-facing failure and reselection content approved and accessible.
- [ ] Provider point validation and stale/unavailable behaviour tested.
- [ ] Shipment booking idempotency and reconciliation operation tested.
- [ ] Label and collection-code access/recovery reviewed.
- [ ] Tracking authentication, normalization and replay controls tested.
- [ ] Uncollected/RTS workflow tested separately from refunds and returns.
- [ ] Monitoring thresholds and privacy-safe alert routes approved.
- [ ] Primary/deputy fulfilment, technical and support ownership assigned.
- [ ] Provider support and escalation routes stored in the restricted register.
- [ ] Every backup carrier/service has independently passed launch gates.
- [ ] Accountable launch owner approves the controlled exercise evidence.

## Related procedures

- `SHIPPING-PRIVACY-AND-SECURITY.md`
- `SHIPPING-COMMERCIAL-VALIDATION.md`
- `FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`
- `PAYMENT-PROVIDER-OUTAGE.md`
- `COMMERCE-DISABLE-AND-ROLLBACK.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`

