# CYPH/1 Commerce API

Runtime-neutral scaffold for the future server-side commerce boundary.

The API is deliberately non-deployable at this stage. It has no HTTP framework
or payment SDK. Those dependencies require an approved implementation ADR.

## Safety defaults

- `COMMERCE_ENABLED=false`
- `PAYMENT_PROVIDER=disabled`
- `FULFILMENT_MODE=disabled`

Configuration fails closed: missing or unrecognised values never enable commerce.

## Database

The schema is maintained as immutable, ordered PostgreSQL migrations in
`db/migrations`. Applied migrations are recorded with a SHA-256 checksum, and
the runner refuses to continue if an applied file has subsequently changed.

```bash
npm run db:migrate --workspace @cyph1/commerce-api
```

`DATABASE_URL` is required. Set `DATABASE_SSL=true` only when the selected
connection requires verified TLS. Render services in the same region should
use the database's internal URL.

The optional development fixture is private, explicitly not for sale, and
guarded against production use:

```bash
ALLOW_DEVELOPMENT_SEED=true npm run db:seed:development --workspace @cyph1/commerce-api
```

Verify a migrated database with transactionally rolled-back constraint checks:

```bash
npm run db:verify --workspace @cyph1/commerce-api
```
