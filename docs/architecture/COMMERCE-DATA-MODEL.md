# CYPH/1 Commerce Data Model

**Status:** Logical schema; database product not yet selected

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

### `fulfilments`

Store order reference, provider key/reference, status, tracking carrier/reference, dispatched/delivered timestamps and idempotency key.

### `audit_events`

Store entity type/ID, action, actor type/ID, correlation ID, safe change summary and timestamp. Never store secrets or raw card information.

## Transaction boundaries

- Order creation and line snapshots commit together.
- A verified webhook event, payment transition and associated order transition commit atomically.
- Fulfilment enqueueing uses an outbox/audit event committed with the paid transition.
- Refund state changes and financial audit events commit together.

## Retention

Financial and order records require a separately approved retention schedule. Marketing records, abandoned baskets, failed webhook payloads and operational logs may have different periods. The application must support purpose-specific retention rather than one global deletion rule.
