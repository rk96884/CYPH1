# CYPH/1 Commerce API

Runtime-neutral scaffold for the future server-side commerce boundary.

The API is deliberately non-deployable at this stage. It has no HTTP framework, database driver or payment SDK. Those dependencies require an approved implementation ADR.

## Safety defaults

- `COMMERCE_ENABLED=false`
- `PAYMENT_PROVIDER=disabled`
- `FULFILMENT_MODE=disabled`

Configuration fails closed: missing or unrecognised values never enable commerce.
