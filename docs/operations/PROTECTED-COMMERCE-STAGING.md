# Protected commerce staging

**Status:** Implementation baseline; account configuration and independent access review outstanding  
**Scope:** Private order operations testing only; no public checkout or live payments

## Boundary

The staging service is a separate Render web service backed by the development
Render PostgreSQL database. Cloudflare Access protects its custom hostname. The
application also validates every Access assertion itself, so reaching the
Render origin does not grant operations access.

The listener exposes only:

- `GET /health` — generic process liveness for Render;
- `GET /ready` — generic database readiness;
- `/operations/*` — cryptographically authenticated operations handlers.

There is no checkout, webhook, customer storefront or public payment route in
this runtime. `COMMERCE_ENABLED=false` remains the staging default.

## Render service

Create a separate Web Service from the CYPH1 repository. Do not reuse the
public static site or early-access Worker.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci && npm run build:runtime --workspace @cyph1/commerce-api` |
| Start command | `npm run start:operations --workspace @cyph1/commerce-api` |
| Health check path | `/health` |
| Database URL | Render development database internal URL |
| Auto deploy | Staging branch or explicitly approved commit only |

Set these encrypted/private environment variables in Render:

- `DATABASE_URL` — internal development database URL;
- `DATABASE_SSL=false` when using the Render internal URL;
- `COMMERCE_ENABLED=false`;
- `PAYMENT_PROVIDER=disabled` unless an approved Mollie sandbox refund exercise is being run;
- `FULFILMENT_MODE=disabled` and `FULFILMENT_PROVIDER=disabled`;
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN` — exact `https://<team>.cloudflareaccess.com` origin;
- `CLOUDFLARE_ACCESS_AUDIENCE` — Access application audience (`aud`) tag;
- `OPERATIONS_ACCESS_GRANTS` — JSON mapping verified operator emails to minimum permissions.

For a sandbox refund exercise only, separately add the Mollie test key and
approved callback origins, then set `PAYMENT_PROVIDER=mollie-test`. A live key
is rejected by the adapter. Never add credentials to Git, Pages variables,
screenshots, issues or values prefixed `PUBLIC_`.

## Cloudflare Access

1. Add a staging custom hostname to the Render service, for example an
   unpublicised operations subdomain of `cyph1.co.uk`, and proxy it through
   Cloudflare.
2. In Cloudflare Zero Trust, create a self-hosted Access application for that
   exact hostname. Do not use a path-only rule that leaves sibling routes open.
3. Create an Allow policy containing only the named operator identity. Access
   is deny-by-default; do not add an Everyone rule or bypass policy.
4. Copy the application audience tag into
   `CLOUDFLARE_ACCESS_AUDIENCE`. Copy the team domain into
   `CLOUDFLARE_ACCESS_TEAM_DOMAIN`.
5. Grant only the permissions required for the exercise in
   `OPERATIONS_ACCESS_GRANTS`. Begin with `orders:read`; add refund, retry or
   export permissions only for their named test.
6. Keep the Render-generated origin URL private, but assume it can be
   discovered. Application JWT validation is the direct-origin protection for
   every `/operations/*` request.

The application accepts only `Cf-Access-Jwt-Assertion`, verifies RS256 against
Cloudflare's remote JWKS, and checks the exact issuer and audience. It ignores
browser-supplied operator IDs and permission headers.

## Verification

Before using synthetic order records:

1. Run `npm run check:commerce`, `npm run test:commerce` and
   `npm run audit:commerce-security` locally or in CI.
2. Confirm `/health` returns only `{ "status": "ok" }`.
3. Open the staging hostname in a private browser and confirm Cloudflare Access
   challenges before the operations page or API is reachable.
4. Confirm an unapproved identity is denied by Access.
5. Call the Render origin `/operations/orders` without an assertion and confirm
   the application returns `401 Authentication required`.
6. Sign in as the approved read-only operator and confirm order search works
   but refund, retry and export requests return `403 Permission denied`.
7. Inspect Render and Cloudflare logs for credentials, assertions, addresses or
   exported order data; none should be retained unnecessarily.

Use synthetic records only. Do not enter real customer, address, payment or
product data during this staging issue.

## Rollback

Set the Render service to suspended or remove the Access Allow policy. Removing
all entries from `OPERATIONS_ACCESS_GRANTS` also makes every operations request
fail closed. Do not weaken the Access policy to recover availability.

Record the account owner, MFA check, operator grant and review date in
`COMMERCE-ACCESS-AND-SECRETS-REVIEW.md`. Completion of this runbook is not a
production launch approval.
