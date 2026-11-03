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
- `GROWTH_DEV_ADMIN_EMAIL=rishikhosla@hotmail.com`: existing authorised administrator.
- `GROWTH_DEV_PASSWORD_HASH`: `scrypt:<32 lowercase hex salt characters>:<128 lowercase hex digest characters>`. Use a freshly generated random 32-byte password represented by 64 lowercase hex characters, a fresh random 16-byte salt and Node's default scrypt parameters with a 64-byte output. Keep the password private and separate from database credentials. Do not put real passwords or hashes in Git, logs, URLs or public build variables.
- `PORT`: provided by hosting platform.

Start the API from repository root after `npm ci`:
```bash
node tools/growth-agent/development-read-api.mjs
```

The owner-approved development alternative uses HTTP Basic authentication directly on the Render HTTPS hostname. Every data request must carry the administrator email and dedicated password in the Authorization header. The API stores only a salted password hash and compares fixed-length digests using timing-safe comparisons. No Cloudflare application, custom domain, team-domain variable, AUD or Access grant variable is required for this development service. Production authentication remains unchanged.

**Do not deploy until** the dedicated credential and read-only role are configured. CORS is not authentication. The credential proves password possession, not mailbox ownership or SSO identity. Anyone obtaining it can act as the administrator. Rotate by replacing the salted hash and deploying the development service. Authentication attempts are bounded to 20/minute per process; attackers can exhaust this shared development allowance and temporarily deny legitimate access. Do not treat it as a production rate limiter.

## 3. Preview dashboard site configuration
On a **separate preview website/Pages project**, set:
- `PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED=true`
- `PUBLIC_COMMERCE_OPERATIONS_SLUG`: an appropriate private path segment
- `PUBLIC_COMMERCE_OPERATIONS_API_URL`: HTTPS origin of your dedicated development API, not `commerce.cyph1.co.uk`
- `PUBLIC_COMMERCE_OPERATIONS_DATA_ENV=development`

The Growth page `/private-operations/<slug>/growth/` displays `DEVELOPMENT DATA` and asks for the administrator password. It keeps it in memory only, sends it in an Authorization header to the configured API, and clears it and displayed data when locked or reloaded. Never save it in browser storage or embed it in the static build. The API permits Authorization preflight requests only from the exact configured development UI origin; preflight responses contain no prospect data.

Production builds that do not set `PUBLIC_COMMERCE_OPERATIONS_DATA_ENV=development` continue to use their existing API configuration and behaviour. **Do not set the development mode variables on the public production Pages project**. Existing production deployments are not modified by this PR.

## 4. Security acceptance checks
1. Without credentials: `GET /operations/growth/prospects` returns **401**.
2. Wrong username, wrong password or forged Cloudflare header: **401** and no data reads.
3. Correct administrator credentials: **200**, `readOnly: true`, `environment: "development"`, and actual source-backed prospects. Never invent a record count.
4. Non-GET returns **405**. Any other route returns **404**. CORS is restricted to `GROWTH_DEV_UI_ORIGIN`.
5. Reader account identity must be exactly `growth_read_dev`. Service startup fails with owner/importer credentials or wrong database, unexpected write grants or commerce access.
6. UI banner says **DEVELOPMENT DATA**; no demo/sample prospects, production data or mutation controls.
7. Production API and www site remain unchanged. No external outreach.

## Current state
Deploy the development API only from the isolated `codex/growth-development-password-auth` branch to Render service `cyph1-growth-api-development`. Do not merge or deploy this branch to production as part of development setup. Build the development UI with the public configuration above and upload to a separate Pages preview branch; do not change the Pages production branch or shared preview environment settings. The default Render origin remains enabled and enforces the same application authentication; it is not protected by Cloudflare Access at the edge.

Rollback by restoring the development service's previous branch/configuration and leaving it unavailable rather than disabling authentication. No database writes or migrations are involved.

## Tests
```bash
node --test tools/growth-agent/development-auth.test.mjs tools/growth-agent/development-read-api.test.mjs
node --test tools/growth-agent/provision-development-reader.test.mjs
node scripts/test-growth-dashboard.mjs
```
