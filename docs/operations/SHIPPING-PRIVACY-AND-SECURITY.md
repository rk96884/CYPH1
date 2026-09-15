# Shipping privacy and security baseline

**Status:** Provider-neutral design baseline; provider contracts and production approval outstanding  
**Production commerce:** Disabled  
**Last engineering update:** 15 September 2026

## Purpose and scope

Define the minimum privacy and security controls for home and **Locker /
Collection Point** delivery before CYPH/1 selects or integrates an aggregator,
carrier or fulfilment provider.

This baseline covers collection-point search and selection, delivery quotes,
shipment booking, labels, tracking, notifications, failed delivery and returns.
It does not approve Sendcloud, InPost, Evri, a data-processing agreement, a
retention period or live personal-data transfer.

## Parties and trust boundaries

The final data map must identify each organisation's actual contractual role.
The likely flow is:

```text
Customer browser
    -> CYPH/1 storefront and commerce API
        -> shipping aggregator (candidate: Sendcloud)
            -> underlying carrier (candidates: InPost or Evri)
        -> fulfilment provider / warehouse where separately appointed

Carrier or aggregator webhook
    -> CYPH/1 authenticated shipping webhook
        -> normalized shipment event and order/fulfilment workflow
```

Do not assume the aggregator is the only processor: the carrier and its
operational partners may receive customer data. Record controller/processor
roles, subprocessors, locations, transfers, purposes, retention and deletion
assistance from the executed agreements.

## Data inventory and minimisation

| Data category | Permitted purpose | Handling boundary |
| --- | --- | --- |
| Recipient name | Address and release the parcel | Send only where required by the selected service |
| Delivery address | Home delivery, eligibility and failed-delivery handling | Do not send for point delivery unless contractually required |
| Email address | Required transactional delivery notifications | Do not use for carrier/aggregator marketing |
| Mobile number | Collection/delivery code and required notifications | Send only where the service requires it; validate without logging |
| Search postcode | Find nearby eligible points | Treat as transient; do not attach to the order unless it is the confirmed destination postcode |
| Browser location/coordinates | Optional nearby-point search | Explicit user action and browser permission; do not persist raw customer location |
| Collection-point ID | Validate and book the chosen destination | Namespace by provider; store with the confirmed order |
| Point name/address/coordinates | Display and preserve the agreed destination | Store an immutable public-location snapshot; do not infer customer residence |
| Order reference | Reconcile shipment to an order | Use a bounded external reference that reveals no customer data |
| Product description/value | Carriage, insurance and claims where required | Use approved minimal description; do not include marketing or unnecessary product data |
| Parcel dimensions/weight | Service eligibility and rating | Store the authoritative packaged snapshot used for booking |
| Tracking number/status | Customer support and delivery evidence | Restrict enumeration; expose only through an authorised customer flow |
| Label and QR/barcode | Physical carriage and parcel release | Treat as restricted bearer-like operational data; short-lived access only |
| Proof of delivery/collection | Resolve delivery, support and claims | Restrict photos, signatures, geolocation and recipient data |
| Provider request/event IDs | Idempotency, audit and reconciliation | Safe to log only under the approved identifier policy |

Do not send date of birth, marketing consent, payment credentials, payment
provider payloads, full order history or unrelated support notes to a shipping
provider.

## Collection-point search and selection controls

- Point search is a server-mediated or tightly scoped provider interaction. Do
  not expose secret API credentials in browser code.
- If a provider requires a browser-visible integration identifier, document its
  intended public status and restrict it by origin/capability where supported.
- Request browser geolocation only after a clear user action. Provide postcode
  search as an equivalent path and explain the immediate purpose.
- Return only fields needed to select a point. Bound search radius, result count,
  request size, frequency and timeout.
- Treat provider point names, instructions and opening information as untrusted
  display data. Escape output and do not render provider HTML.
- Bind the selected point to the quote/order attempt using a server-controlled
  token or server revalidation. A customer-supplied point ID is never proof of
  eligibility.
- Display the selected carrier, point name and address before final submission.
- Never silently substitute another point. Require reselection if the point is
  unavailable or incompatible.
- Do not retain unsuccessful searches, raw coordinates or nearby-point histories
  without an approved purpose.

## Shipment booking and label controls

- Recalculate proposition, service eligibility, customer charge, parcel facts
  and collection-point validity on the server.
- Book only after the authoritative payment/fulfilment gate permits it.
- Use a stable idempotency key and persist the reservation before the external
  booking call. A timeout must enter reconciliation/manual review rather than
  create an unbounded second shipment.
- Store provider credentials only in the server secret store, separated by
  environment and scoped to necessary capabilities.
- Fetch labels only for authorised fulfilment operations. Do not place label
  content or permanent public URLs in customer pages, logs, tickets or source
  control.
- Use short-lived signed object access where labels must be stored. Record label
  creation/access metadata without copying label contents into audit events.
- Labels, QR codes and pickup codes may permit parcel handling or release and
  must be treated as restricted even when the carrier does not call them
  credentials.

## Shipping webhook controls

Each provider adapter must define its authenticity mechanism. The endpoint
must:

1. accept only the documented method, content type and bounded body size;
2. preserve the exact raw body where signature verification requires it;
3. verify the signature/MAC or perform the approved provider-authenticated
   lookup before trusting business meaning;
4. validate timestamp tolerance where supported;
5. compare secrets/signatures safely;
6. deduplicate using provider plus stable event ID;
7. schema-validate the minimum required fields;
8. map raw statuses through an explicit allowlist/state machine;
9. make the event record and allowed state transition atomic;
10. acknowledge duplicates without repeating notifications or fulfilment; and
11. retain failures for bounded retry/manual review without logging payloads.

Source-IP allowlisting may be defence in depth but cannot replace cryptographic
or provider-authenticated verification. Rotate webhook secrets through a
documented overlap procedure where the provider supports it.

## Principal threats and required controls

| Threat | Required control | Fail-safe outcome |
| --- | --- | --- |
| Customer changes point/carrier/service fields | Server revalidation and immutable selection snapshot | Reject and require a valid selection |
| Point becomes unavailable after checkout | Revalidate before booking | Reselection, approved home fallback or manual review |
| Malicious provider point text/URL | Schema validation, escaping and trusted map/link construction | Omit unsafe field; retain point ID for review |
| Forged or replayed tracking event | Authenticated webhook, timestamp policy, event deduplication and state machine | Reject/ignore and alert without changing shipment |
| Duplicate shipment after timeout | Durable booking idempotency and provider reconciliation | Hold in `requires_review`; do not rebook blindly |
| Enumeration of tracking/order status | High-entropy customer access, authorization and rate limiting | Generic response without customer/shipment disclosure |
| Exposed label or collection code | Restricted storage, short-lived access and no logging | Revoke/regenerate where supported; incident review |
| Carrier status overwrites order truth | Separate shipment, fulfilment, order and payment states | Store event; block invalid transition |
| Aggregator compromise/outage | Least-privilege keys, provider abstraction, monitoring and documented fallback | Stop new affected bookings; preserve existing evidence |
| Excessive customer data sent to provider | Explicit field allowlist per service | Block request failing the approved adapter schema |
| Customer location history created by search | Transient search and no raw-location logging | Discard after response |
| Wrong carrier chosen behind generic option | Bind routing to disclosed proposition, point and constraints | Requote/reselect; never silently degrade the promise |
| Provider return/redirect changes destination | Authenticate event and require allowed workflow/manual approval | Do not overwrite original order snapshot |
| Shipping data reintroduced from backup | Retention/suppression record and restore reconciliation | Quarantine restored data pending approved treatment |

## Logging and monitoring

Application request logs must not contain:

- recipient names, emails, mobile numbers or addresses;
- search postcodes or customer coordinates;
- collection/pickup codes, label URLs, barcodes or label content;
- full tracking numbers or point-selection tokens;
- request/response bodies, provider credentials or webhook signatures;
- proof-of-delivery photos/signatures or provider free text.

Use fixed event names, correlation IDs, normalized outcome/error codes, provider
key where operationally necessary, rounded duration and HTTP status. Provider
shipment/tracking/point identifiers may appear only in restricted audit or
operations records with a documented purpose; prefer internal shipment IDs in
ordinary logs.

Monitor aggregate point-search failures, booking latency/errors, webhook
verification failures, retry exhaustion, tracking-event delay and provider
outages. Do not add customer attributes to metrics.

## Retention and rights requests

- Failed/unconfirmed point searches: normally transient and not persisted.
- Confirmed point snapshot: retain with the order only for the approved
  fulfilment, support, claims, financial and legal purposes.
- Labels and pickup/collection codes: shortest operational period; remove
  public access immediately when no longer needed.
- Detailed tracking events and proof of delivery: retain for the approved
  support/claims period, not automatically for the full financial-record period.
- Raw provider webhook bodies: retain only if necessary for verification,
  retry, dispute or incident evidence; define a short category-specific period.
- Aggregator/carrier copies and backups: record contractual periods, deletion
  capability and rights-request assistance separately.

The rights-request inventory must search CYPH/1 records and, where applicable,
the aggregator, carrier, fulfilment provider, support system, exports and
backups. Deleting a reusable customer profile must not erase required order or
delivery evidence indiscriminately; retained fields require a documented
purpose, scope and review trigger.

## Provider due diligence and launch evidence

Before transferring production customer data, obtain and approve:

- executed contract and DPA;
- controller/processor allocation and subprocessor list;
- processing and hosting locations and transfer safeguards;
- exact mandatory data fields per enabled service;
- role-based access, MFA, credential scope/rotation and audit capabilities;
- API and webhook security documentation;
- retention, backup, deletion and rights-request assistance terms;
- breach-notification commitments and security contact route;
- incident, outage, export and contract-exit procedures; and
- evidence that optional marketing or profiling is disabled for shipment data.

Store confidential evidence in the restricted provider register. Source control
records the provider, document/version, approval role/date, review date and
outstanding exception—not confidential terms or personal contacts.

## Launch gates

- [ ] Final data-flow map names every aggregator, carrier, fulfilment provider
      and operational subprocessor.
- [ ] Service-specific outbound field allowlists approved and tested.
- [ ] Browser-visible point-selector identifiers reviewed and constrained.
- [ ] Point substitution, stale selection and provider outage behaviour tested.
- [ ] Shipment booking idempotency and timeout reconciliation tested.
- [ ] Provider webhook authenticity, replay and duplicate-event controls tested.
- [ ] Label, pickup-code, tracking and proof-of-delivery access reviewed.
- [ ] Logging/metric redaction tests cover shipping canaries.
- [ ] Retention/deletion and rights-request handling approved for each category.
- [ ] Contract, DPA, subprocessors, transfers and incident routes approved.
- [ ] Privacy notice and processing record accurately describe live recipients.
- [ ] Accountable privacy, security, fulfilment and launch owners sign off.

## Related documents

- `../architecture/decisions/0003-provider-neutral-collection-point-delivery.md`
- `../architecture/COMMERCE-THREAT-MODEL.md`
- `LOGGING-AND-EXPORT-DATA-BOUNDARIES.md`
- `CUSTOMER-DATA-RETENTION-AND-DELETION.md`
- `SHIPPING-COMMERCIAL-VALIDATION.md`
- `COMMERCE-LAUNCH-READINESS.md`

