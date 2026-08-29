# CYPH/1 Proposed Commerce Project Structure

## Decision

Keep the existing Astro website and add commerce as isolated workspace packages. Do not create a separate public store repository or domain. The exact runtime/database choices remain open, so this document defines boundaries rather than adding dependencies prematurely.

## Proposed repository shape

```text
CYPH1/
├── src/                         # Existing Astro site; evolves into storefront
│   ├── components/
│   │   └── commerce/            # Basket/product UI only when approved
│   ├── pages/
│   │   ├── product/             # Approved product routes
│   │   ├── basket.astro
│   │   └── order/               # Pending/confirmation/status pages
│   └── data/                    # Brand/editorial data, not live prices
├── apps/
│   └── commerce-api/
│       ├── src/
│       │   ├── http/            # Routes, schemas and response mapping
│       │   ├── modules/
│       │   │   ├── catalogue/
│       │   │   ├── checkout/
│       │   │   ├── orders/
│       │   │   ├── payments/
│       │   │   ├── refunds/
│       │   │   ├── fulfilment/
│       │   │   └── reconciliation/
│       │   ├── infrastructure/  # Database, queues, email, configuration
│       │   └── entrypoint.ts
│       └── tests/
├── packages/
│   ├── commerce-core/           # Pure domain types, money and state rules
│   ├── payment-providers/
│   │   ├── contract/
│   │   ├── mollie/
│   │   ├── square/              # Added only when authorised
│   │   └── stripe/              # Added only when justified
│   ├── fulfilment-providers/
│   │   └── contract/
│   └── shared-schemas/          # Versioned public request/response schemas
├── database/
│   ├── migrations/
│   ├── seeds/                   # Non-production, unmistakable test records
│   └── README.md
├── docs/
│   ├── architecture/
│   └── operations/
└── .env.example                 # Names and safe examples only
```

Directories should be introduced with the milestone that uses them rather than as empty placeholders.

## Dependency direction

```text
Astro storefront ---> shared schemas
Commerce API ------> commerce core
Commerce API ------> provider contracts
Provider adapters -> provider contracts + external SDK/API
Commerce core -----> no framework, database or provider dependency
```

The core domain must not import Astro, HTTP frameworks, database clients or payment SDKs.

## Module responsibilities

### `commerce-core`

- Money arithmetic and currency validation.
- Basket totals and approved adjustments.
- Order/payment/refund state transitions.
- Domain errors and idempotency semantics.
- No I/O.

### `commerce-api`

- Authentication/authorisation and request validation.
- Transaction orchestration.
- Database repositories and outbox processing.
- Provider/fulfilment adapter selection.
- Safe HTTP responses, logs and metrics.

### `payment-providers`

- Provider authentication and API calls.
- Signature/authenticity verification.
- Provider-to-domain event normalisation.
- No business decisions about whether an order may be sold or fulfilled.

### Astro storefront

- Accessible customer presentation.
- Product selection and basket interactions.
- Calls commerce API with identifiers/quantities, never authoritative totals.
- Displays internal order status.
- Contains no payment-provider secrets or SDK-specific order logic.

## Feature flags

At minimum:

- `COMMERCE_ENABLED=false` — server-side master gate.
- `PUBLIC_COMMERCE_UI_ENABLED=false` — compile/deployment-time UI gate, never sufficient alone.
- `PAYMENT_PROVIDER=mollie-test` — server-only configured adapter.
- `FULFILMENT_MODE=disabled` — prevents accidental fulfilment in foundation work.

Production must fail closed when required configuration is absent. Preview deployments must always use test providers.

## API surface baseline

```text
GET  /v1/catalogue
POST /v1/baskets/quote
POST /v1/orders
POST /v1/orders/:id/checkout
GET  /v1/orders/:publicToken/status
POST /v1/webhooks/payments/:provider
```

Administrative refund, reconciliation and fulfilment endpoints belong behind separate authentication and are not part of the public baseline.

## Testing layout

- Unit tests for money, totals and state machines.
- Contract tests shared by all payment adapters.
- Repository tests against an isolated database.
- Integration tests for checkout/webhook/refund flows.
- End-to-end tests using provider test modes.
- Accessibility and responsive tests for storefront additions.
- Failure tests for retries, duplicate events and provider outages.

## Initial scaffolding sequence

1. Decide workspace tooling, runtime and database through a short implementation ADR.
2. Create `commerce-core` with no runtime dependencies beyond TypeScript/test tooling.
3. Add migrations and repository interfaces.
4. Add the commerce API with all public commerce routes disabled.
5. Add the provider contract and fake adapter for deterministic tests.
6. Add Mollie test adapter.
7. Add private storefront routes behind both flags.

No Square, Stripe or Revolut-specific code should be added until its implementation milestone is authorised.
