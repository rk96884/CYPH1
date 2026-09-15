# ADR 0003: Provider-neutral collection-point delivery

**Status:** Accepted direction; implementation and provider selection pending  
**Date:** 15 September 2026

## Context

CYPH/1 intends to offer convenient out-of-home delivery alongside home
delivery. InPost Locker/Shop and Evri Locker/ParcelShop are candidate services,
and Sendcloud is the leading aggregator candidate. None has completed
commercial, carriage, compensation, privacy or technical validation.

The storefront should not force customers to understand carrier product
catalogues. The commerce domain must also remain portable enough to add Royal
Mail, DPD, a direct carrier connection or another aggregator without redesigning
checkout or rewriting historical orders.

Current shipping tables support customer-facing methods and configurable rates,
while current fulfilment records support a provider, tracking carrier and
tracking reference. They do not yet model delivery propositions separately from
provider services or define a collection-point selection and snapshot.

Current IPL candidates are mains-powered, contain no battery and use an external
AC/DC power adapter. Final product, packaging, packaged dimensions, packaged
weight and approved retail/replacement value remain pending.

## Decision

### Customer proposition

Present **Locker / Collection Point** as the preferred generic out-of-home
delivery proposition. Home and express propositions may be offered separately
when approved. Do not show separate InPost and Evri choices by default unless a
material customer difference in price, coverage, timing or collection terms
justifies that complexity.

Before payment, a collection-point customer must be able to:

1. search for eligible nearby points;
2. see the selected point's name and location;
3. change or remove the selection; and
4. confirm the point used for the order.

The actual carrier and selected location must be disclosed before order
submission even when the proposition name is generic.

### Domain boundaries

Keep these concepts distinct:

- **Delivery proposition:** the stable customer outcome, such as
  `standard-home`, `collection-point` or `express-home`.
- **Carrier service:** a provider-specific service capable of satisfying a
  proposition for a particular parcel and destination.
- **Delivery selection:** the customer's chosen proposition and, where
  applicable, collection point.
- **Shipment:** a booked movement with provider/carrier references, labels,
  tracking and operational status.
- **Fulfilment:** the wider operational process that may create, cancel or
  return one or more shipments for a paid order.

The browser may submit a proposition key and opaque point-selection token or
identifier. It may not authoritatively choose the carrier service, price,
eligibility, address or parcel attributes. The server must validate and
snapshot them.

### Provider abstraction

Use a CYPH/1-owned shipping-provider contract for:

- resolving eligible services;
- searching and retrieving collection points;
- validating a point against service, parcel and destination constraints;
- creating and cancelling shipments idempotently;
- retrieving labels through restricted operational access;
- creating returns where supported;
- normalising tracking events; and
- authenticating and deduplicating provider webhooks.

Provider-native identifiers and raw statuses may be stored for traceability,
but they must not become customer proposition keys or unrestricted domain
states. Sendcloud must therefore remain replaceable or supplementable.

### Pricing

Customer shipping prices remain CYPH/1-controlled, effective-dated business
data. Store the customer charge independently from the eventual carrier cost.
Carrier quotes or provider rate cards must not be exposed as authoritative UI
prices or hard-coded into components.

### Collection-point evidence

Store the provider point identifier and immutable point snapshot on the order.
The snapshot is historical evidence and must not be silently updated when the
provider later changes its location directory. Keep the customer's contact or
billing address separate from the collection-point destination.

Revalidate the point before shipment booking. If the selector, carrier API or
selected point is unavailable, require customer reselection or use an explicitly
approved home-delivery fallback. Never silently ship to a different collection
point.

### Initial provider direction

- Sendcloud is the leading aggregator candidate, subject to commercial and
  technical validation.
- InPost and Evri are candidate underlying carriers.
- No provider, service, rate, insurance arrangement or integration is approved
  by this ADR.

## Consequences

- Checkout can retain simple, stable delivery language while operations change
  carrier or aggregator.
- The order model needs normalized delivery-selection and collection-point
  fields plus immutable snapshots.
- Shipment booking and tracking need a narrower provider contract in addition
  to the existing general fulfilment boundary.
- Location search introduces availability, privacy, accessibility and failure
  handling requirements.
- Using an aggregator reduces initial carrier-specific work but adds an
  operational dependency and another processor/subprocessor relationship.
- Provider-specific features remain usable through capability flags without
  leaking them into every checkout component.

## Alternatives considered

### Expose InPost and Evri as permanent checkout methods

Rejected as the default because it couples customer choices to carrier
contracts and makes later routing or replacement disruptive. It remains
possible when the difference is genuinely useful to customers.

### Integrate one carrier directly into the order model

Rejected because point identifiers, service codes and statuses would leak into
checkout, orders and operations, increasing redesign and migration costs.

### Make Sendcloud the domain model

Rejected. Sendcloud is a candidate adapter, not the owner of CYPH/1 delivery
semantics or historical order evidence.

### Select the cheapest service only at fulfilment time

Rejected where it could change a disclosed carrier, collection location,
delivery type or promise after payment. Routing may occur only within the
customer-approved proposition and recorded constraints.

## Launch gates

Before enabling any live shipping service:

1. Select the final product and packaging and record packaged dimensions and
   weight.
2. Obtain written carrier acceptance of the complete mains-powered IPL device
   and external adapter for outbound and return services.
3. Approve loss and damage compensation or insurance at the expected
   retail/replacement value.
4. Confirm business rates, surcharges, returns, minimum volumes and geographic
   restrictions.
5. Approve provider/aggregator contracts, DPA, subprocessors and retention.
6. Implement and test the provider boundary, point UX, snapshots, webhook
   authentication, reconciliation and fallbacks.
7. Complete accessible checkout and controlled end-to-end delivery/return
   exercises.

## Reconsideration triggers

Revisit this decision if:

- the selected fulfilment partner mandates a different shipping platform;
- an aggregator cannot provide required carrier services, compensation or data
  portability;
- customer research supports explicit carrier choice;
- international launch creates materially different propositions;
- volume makes direct contracts and integrations operationally preferable; or
- a provider cannot meet security, privacy, accessibility or reliability gates.

## Related documents

- `../COMMERCE-ARCHITECTURE-PROPOSAL.md`
- `../COMMERCE-DATA-MODEL.md`
- `../../operations/SHIPPING-COMMERCIAL-VALIDATION.md`
- `../../operations/COMMERCE-LAUNCH-READINESS.md`

