# Development-only Growth Intelligence dashboard connection

## Why a separate API?
The five imported creators live in `cyph1_commerce_development`. The existing production Operations API must **not** be pointed to that database. This implementation introduces a separate, single-purpose **read-only** development API, backed by a separately authenticated read-only account. It does not create any storefront or commerce endpoints and cannot import or contact prospects.

## 1. Provision a read-only development role (manual workflow)
In GitHub Settings → Environments → `development-db`, add **Environment secret** `GROWTH_READ_ROLE_PASSWORD`, a unique random password of at least 32 characters. Save it securely. It is distinct from `GROWTH_IMPORT_ROLE_PASSWORD`; never put it in the front end, a PR or screenshots.

Run Actions → **Development Growth dashboard reader role** on `main`:
- `action=plan`, confirmation blank. Read-only; verifies exact `cyph1_commerce_development` database and role absent.
- After plan passes, `action=apply` with confirmation `CREATE-DEVELOPMENT-GROWTH-READER`. Requires explicit manual approval. Creates `growth_read_dev` with **SELECT on growth.prospects and growth.prospect_evidence only**, plus schema usage and database connect.
- The script checks the role has *no* writes, no commerce access and no access to audit, suppression, outreach or research-run records before committing. It refuses to rerun if the role already exists.

## 2. Deployment prerequisites (not done by merging)
Deploy a **separate private development API** (for example a separate Render web service with its own service/environment settings); never replace or repoint the production Operations API.

Configure the service with private environment variables, not `PUBLIC_*`:
- `GROWTH_DATA_ENV=development`
- `GROWTH_DEV_READ_DATABASE_URL`: securely assembled PostgreSQL TLS URI for the **growth_read_dev** user, exact database `cyph1_commerce_development`. Keep this value secret; do not reuse the owner or importer's URL. Set the password with correct URI percent-encoding.
- `GROWTH_DEV_UI_ORIGIN`: exact separate preview UI origin, for example `https://your-preview.example.net` or `http://localhost:4321`. Never the public CYPH/1 website.
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: existing trusted Cloudflare Access HTTPS team URL ending in `.cloudflareaccess.com`.
- `CLOUDFLARE_ACCESS_AUDIENCE`: **API application** audience (must correspond to the Access policy protecting this dedicated API host).
- `OPERATIONS_ACCESS_GRANTS`: JSON mapping the permitted operator identity to **only** `["growth:read"]`; use your real pre-approved operator email, do not commit it.
- `PORT`: provided by hosting platform.

Start the API from repository root after `npm ci`:
```bash
node tools/growth-agent/development-read-api.mjs
```

Put the API behind Cloudflare Access so that successful authorization forwards the signed `cf-access-jwt-assertion` header to Node; the code independently verifies the JWT's signature, issuer, audience, expiry and `growth:read` allowlist. Protect both the application and API origins. This endpoint **never** sends contact messages or writes to the database. The API returns HTTP 403 without an approved JWT and exposes no commerce routes.

**Do not deploy publicly until** API Access protection, forwarding and the read-only role are verified. A mere Cloudflare Access cookie on another hostname is not sufficient to authorize this API, and CORS alone is not an access-control mechanism.

## 3. Preview dashboard site configuration
On a **separate preview website/Pages project**, set:
- `PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED=true`
- `PUBLIC_COMMERCE_OPERATIONS_SLUG`: an appropriate private path segment
- `PUBLIC_COMMERCE_OPERATIONS_API_URL`: HTTPS origin of your dedicated development API, not `commerce.cyph1.co.uk`
- `PUBLIC_COMMERCE_OPERATIONS_DATA_ENV=development`

The existing Growth page `/private-operations/<slug>/growth/` will then display `DEVELOPMENT DATA` and query the protected development endpoint. It uses `credentials: include`, handles Access denials, and only displays validated source-backed entries.

Production builds that do not set `PUBLIC_COMMERCE_OPERATIONS_DATA_ENV=development` continue to use their existing API configuration and behaviour. **Do not set the development mode variables on the public production Pages project**. Existing production deployments are not modified by this PR.

## 4. Security acceptance checks
1. Without an Access JWT: `GET /operations/growth/prospects` returns **403**.
2. With a valid Access JWT lacking `growth:read`: **403**.
3. With valid approved identity, proper Access API audience and origin: **200** and `readOnly: true`, `environment: "development"`, and 5 source-backed prospects.
4. Non-GET returns **405**. Any other route returns **404**. CORS is restricted to `GROWTH_DEV_UI_ORIGIN`.
5. Reader account identity must be exactly `growth_read_dev`. Service startup fails with owner/importer credentials or wrong database, unexpected write grants or commerce access.
6. UI banner says **DEVELOPMENT DATA**; no demo/sample prospects, production data or mutation controls.
7. Production API and www site remain unchanged. No external outreach.

## Current state
This PR provides code, tests and the manually approved reader-role workflow. **No new database role or hosted API service is created or deployed on merge.** Deploy the endpoint only after an approved service/workspace selection and verification of Cloudflare Access configuration.

## Tests
```bash
node --test tools/growth-agent/development-read-api.test.mjs
node --test tools/growth-agent/provision-development-reader.test.mjs
node scripts/test-growth-dashboard.mjs
```
