# CYPH/1 Commerce Data Model

**Status:** Implemented baseline plus proposed provider-neutral shipping extension

## Conventions

- Use UUIDs or another collision-resistant internal identifier.
- Store money as integer minor units plus an ISO 4217 currency code; never use floating point.
- Store timestamps in UTC and display them in the appropriate locale.
- Use immutable order-line snapshots for historical accuracy.
- Keep order, payment, fulfilment and marketing-consent states separate.
- Use database constraints for invariants and application state machines for allowed transitions.
- Prefer archival/status fields over destructive deletion where financial audit records must remain.

## Tables

### `products`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `sku` | Unique CYPH/1 SKU |
| `slug` | Stable storefront path key |
| `name` | Approved product name |
| `description` | Approved product copy |
| `status` | `draft`, `private`, `active`, `retired` |
| `price_minor` | Authoritative price in minor units |
| `currency` | Initial value `GBP` |
| `tax_code` | Approved tax classification |
| `fulfilment_sku` | External fulfilment mapping |
| `shipping_weight_grams` | Approved packaged unit weight used for shipping quotes |
| `content_version` | Claims/content approval reference |
| timestamps | Creation and update audit |

Only `active` products may be purchased. Pre-launch placeholder products must remain `draft` or `private`.

### `inventory_levels`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `product_id` | Product reference |
| `location_key` | Fulfilment location |
| `available_quantity` | Sellable units |
| `reserved_quantity` | Units held for checkout/orders |
| `safety_stock` | Units withheld from sale |
| `source` | Manual, 3PL or other source |
| `source_updated_at` | Freshness indicator |

Unique constraint: `(product_id, location_key)`.

### `customers`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `email_normalised` | Case-normalised lookup value |
| `email_display` | Original customer-facing value |
| `created_at` | Audit timestamp |
| `retention_review_at` | Privacy review date |

Do not place marketing consent directly on the customer row; consent requires its own evidence trail.

### `customer_consents`

| Field | Purpose |
| --- | --- |
| `id` | Evidence record |
| `customer_id` | Customer reference |
| `purpose` | Specific consent purpose |
| `status` | Granted or withdrawn |
| `wording_version` | Exact approved wording version |
| `source` | Checkout, early access or other source |
| `recorded_at` | Evidence timestamp |

Purchase must not require marketing consent.

### `addresses`

Store delivery/contact data required for fulfilment. The order also stores an immutable address snapshot so subsequent customer edits do not alter historical orders.

### Shipping destinations and rates

Shipping is country-led with reusable zone defaults:

- `shipping_zones` groups destinations such as UK, EU and supported global regions.
- `shipping_zone_countries` maps each ISO country code to exactly one zone and records whether that destination is disabled, test-only, active or restricted.
- `shipping_methods` defines customer-facing services such as tracked standard or express.
- `shipping_rates` provides effective-dated zone defaults, with optional country-specific overrides for the same method.

Rates store integer minor units and currency, optional order-value and packaged-weight bands, an optional free-shipping threshold, status and version. A country override takes precedence over its zone default. No matching active rate means the destination cannot be quoted; the system must never silently fall back to a generic worldwide price.

UK-only shipping remains the initial operational default. EU and global countries must remain disabled until their fulfilment, customs, tax, product-compliance and delivery-message requirements are approved.

The existing country/zone/method/rate structure remains authoritative for the
customer charge. It must not be replaced by a carrier rate response. The
following proposed extension separates the customer proposition from whichever
carrier service later fulfils it. It is a logical design only; no migration is
authorised by this document.

### `delivery_propositions` — proposed

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `key` | Stable domain key such as `standard-home`, `collection-point` or `express-home` |
| `display_name` | Approved customer-facing name |
| `delivery_type` | Normalized `home`, `locker` or `pudo` capability represented to checkout |
| `status` | Disabled, test, active or retired |
| `sort_order` | Approved checkout ordering without encoding priority in components |
| `content_version` | Customer wording approval reference |
| timestamps | Creation and update audit |

`shipping_methods` should reference one proposition. Multiple effective-dated
methods or rates may satisfy the same proposition without changing customer
language.

### `carrier_services` — proposed

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `shipping_provider` | Adapter key, for example an aggregator or direct integration |
| `carrier_key` | Normalized underlying carrier key |
| `provider_service_code` | Opaque provider service identifier |
| `service_name` | Restricted operational display name |
| `delivery_type` | `home`, `locker` or `pudo` |
| `status` | Disabled, test, active or retired |
| `country_code` | Supported ISO destination country where service-specific |
| `min/max_weight_grams` | Approved packaged-weight constraints |
| `max_length/width/height_mm` | Approved packaged-dimension constraints |
| `max_declared_value_minor` | Contractual maximum, not customer price |
| `currency` | Currency for value constraint |
| `capabilities` | Validated feature flags such as point search, returns or label format |
| `terms_version` | Commercial/service evidence reference |
| effective timestamps | Service eligibility period |

Do not use free-form capabilities to bypass validated domain rules. A join from
`delivery_propositions` or `shipping_methods` to eligible carrier services may
express which services can fulfil a proposition.

### `delivery_selections` — proposed

One immutable selection belongs to an order version or checkout/order attempt.

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `order_id` | Order reference |
| `delivery_proposition_id` | Customer-approved proposition |
| `delivery_type` | Normalized type snapshotted at selection |
| `shipping_method_snapshot` | Customer method and wording evidence |
| `collection_point_provider` | Provider namespace when a point is required |
| `collection_point_id` | Opaque provider point identifier |
| `collection_point_snapshot` | Immutable structured point name, type, address, country, coordinates and instructions |
| `point_validated_at` | Last successful server validation before order submission |
| `parcel_snapshot` | Weight, dimensions and value inputs used for eligibility |
| `customer_charge_minor` | Delivery amount charged to the customer |
| `currency` | Charge currency |
| timestamps | Selection and confirmation evidence |

For home delivery, the order's delivery-address snapshot remains the
destination. For collection-point delivery, retain the customer's necessary
contact address separately and treat the collection-point snapshot as the
shipment destination. Never overwrite one with the other.

Coordinates are point-directory data, not evidence that CYPH/1 tracked the
customer's live location. Postcode or coordinate search inputs should not be
persisted unless required for a documented purpose.

### `orders`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `order_number` | Unique customer-facing CYPH/1 reference |
| `customer_id` | Nullable customer reference where appropriate |
| `status` | Normalised order state |
| `fulfilment_status` | Separate fulfilment state |
| `currency` | Order currency |
| `subtotal_minor` | Sum before adjustments |
| `discount_minor` | Approved discounts |
| `tax_minor` | Tax total |
| `delivery_minor` | Delivery total |
| `total_minor` | Final amount due |
| `delivery_address_snapshot` | Immutable structured snapshot |
| `billing_address_snapshot` | Only where required |
| `shipping_rate_id` | Internal rate used to produce the quote |
| `shipping_country_code` | ISO destination used for rate selection |
| `shipping_method_snapshot` | Immutable service name/key snapshot |
| `shipping_rate_snapshot` | Immutable zone, country override, thresholds and rate-version evidence |
| `delivery_selection_id` | Immutable selected delivery proposition and collection-point evidence |
| `version` | Optimistic concurrency value |
| timestamps | Created, updated, paid, cancelled |

Constraint: totals are non-negative and `total = subtotal - discount + tax + delivery` according to the approved tax model.

### `order_items`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `order_id` | Order reference |
| `product_id` | Catalogue reference |
| `sku_snapshot` | Purchased SKU |
| `name_snapshot` | Purchased name |
| `unit_price_minor` | Purchased unit price |
| `unit_weight_grams` | Packaged unit-weight snapshot used by the quote |
| `quantity` | Positive integer |
| `tax_minor` | Line tax snapshot |
| `line_total_minor` | Final line total |

### `payments`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `order_id` | Order reference |
| `provider` | Mollie, Square, Stripe or future key |
| `provider_payment_id` | Provider reference |
| `status` | Normalised payment state |
| `amount_minor` | Expected payment amount |
| `currency` | Expected currency |
| `idempotency_key` | Unique creation key |
| `provider_created_at` | Provider timestamp |
| timestamps | Internal audit |

Unique constraints: `(provider, provider_payment_id)` and `idempotency_key`.

### `refunds`

Store payment reference, amount, currency, reason, normalised state, provider refund ID, idempotency key and timestamps. The sum of completed refunds must not exceed the captured payment.

### `webhook_deliveries`

Store each unmodified raw request body, its SHA-256 digest, provider,
verification outcome and correlation ID. A delivery is retained even when
authenticated provider lookup fails, allowing safe retry and audit without
treating the untrusted body as a business event.

### `webhook_events`

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `provider` | Provider key |
| `provider_event_id` | Deduplication identifier |
| `event_type` | Provider event name |
| `signature_valid` | Validation result |
| `processing_status` | Received, processed, ignored or failed |
| `payload_reference` | Controlled payload storage reference if required |
| `attempt_count` | Processing attempts |
| `last_error_code` | Non-sensitive diagnostic code |
| timestamps | Received and processed |

Unique constraint: `(provider, provider_event_id)` where the provider supplies a stable event ID.

### `outbox_events`

Store a unique event key, normalised event type, aggregate identity and safe
payload in the same transaction as payment and order transitions. A separate
publisher may deliver pending events later; inserting the same provider event
again cannot enqueue downstream work twice.

### `fulfilments`

Store order reference, provider key/reference, status, tracking carrier/reference, dispatched/delivered timestamps and idempotency key.

`fulfilments` remains the paid-order operational boundary. It may own one or
more shipment attempts without losing the original customer-approved delivery
selection.

### `shipments` — proposed

| Field | Purpose |
| --- | --- |
| `id` | Internal identifier |
| `fulfilment_id` | Parent fulfilment reference |
| `delivery_selection_id` | Customer-approved destination/proposition evidence |
| `carrier_service_id` | Service selected by the server |
| `shipping_provider` | Adapter that booked the shipment |
| `carrier_key` | Underlying carrier |
| `provider_shipment_id` | Provider booking reference |
| `tracking_number` | Carrier tracking reference |
| `tracking_url` | Validated customer-safe URL where retained |
| `status` | Normalized shipment state |
| `raw_provider_status` | Restricted traceability value |
| `carrier_cost_minor` | Actual/estimated carrier cost, separate from customer charge |
| `currency` | Cost currency |
| `label_reference` | Restricted short-lived object/reference, not public label content |
| `collection_expires_at` | Provider collection deadline when supplied |
| `idempotency_key` | Unique booking command key |
| timestamps | Created, dispatched, collected/delivered, returned and updated |

Suggested normalized shipment states are `pending`, `booking`, `booked`,
`accepted`, `in_transit`, `ready_for_collection`, `delivered`, `collection_expired`,
`return_to_sender`, `returned`, `cancelled`, `failed` and `requires_review`.
Provider events must map through an explicit adapter; never update state from an
unrestricted provider string.

### `shipment_events` — proposed

Store the shipment, provider event ID, normalized event type/status, restricted
raw status, occurrence/receipt timestamps, safe location classification,
processing outcome and correlation ID. Enforce provider-scoped deduplication.
Do not copy recipient details or full provider payloads into this table.

### Collection-point directory data

Prefer live provider lookup with bounded caching over a permanent local mirror.
If caching is required, retain provider, point ID, type, public location data,
capabilities, provider update time and cache expiry only. A cache entry is not
proof of current availability; booking requires revalidation. Historical orders
use their immutable point snapshot even after the cache entry expires.

### `audit_events`

Store entity type/ID, action, actor type/ID, correlation ID, safe change summary and timestamp. Never store secrets or raw card information.

## Transaction boundaries

- Order creation and line snapshots commit together.
- A verified webhook event, payment transition and associated order transition commit atomically.
- Fulfilment enqueueing uses an outbox/audit event committed with the paid transition.
- Refund state changes and financial audit events commit together.
- Order confirmation commits the delivery selection and its point/parcel
  snapshots with the authoritative delivery charge.
- Shipment reservation and its idempotency key commit before the external
  provider call; provider confirmation is applied in a separate safe
  transaction.
- A verified shipment webhook, deduplication record, normalized shipment event
  and allowed state transition commit atomically.

## Shipping invariants

- A collection-point proposition requires a provider-namespaced point ID and a
  validated immutable point snapshot.
- A home proposition must not treat a collection-point address as the
  customer's home/contact address.
- Carrier service, parcel constraints and point eligibility are revalidated on
  the server before booking.
- The customer charge comes from approved CYPH/1 rate data; carrier cost cannot
  silently change the paid order total.
- Routing cannot change the confirmed delivery proposition or collection point.
- A provider timeout cannot trigger an unbounded second booking; retry or lookup
  uses the same idempotency evidence.
- Tracking and delivery events cannot mark an unpaid order fulfilled.
- A missing/invalid point, unsupported parcel or unavailable provider fails
  closed to reselection, approved fallback or manual review.
- Labels and point-selection tokens are never exposed as unrestricted public
  object references.

## Retention

Financial and order records require a separately approved retention schedule. Marketing records, abandoned baskets, failed webhook payloads and operational logs may have different periods. The application must support purpose-specific retention rather than one global deletion rule.

Collection-point searches should normally be transient. Retain the confirmed
point snapshot with the order for the approved order/fulfilment period; retain
provider labels, raw shipment payloads and detailed tracking events only for
their documented operational, claims or legal purpose. Provider and aggregator
retention must be included in the privacy/processor review.
