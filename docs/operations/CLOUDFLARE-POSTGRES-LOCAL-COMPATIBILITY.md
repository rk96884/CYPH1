# PR #142 — Local PostgreSQL/Cloudflare compatibility probe

**Preparation only. NO deployment, Hyperdrive, database connections, emails, payments, secrets or production changes.**

This is *stage one* from the merged Cloudflare feasibility plan. The build-only entry `prototypes/cloudflare-commerce-cron/src/pg-compat-probe.mjs` imports the already-installed `pg` driver but **never constructs a client, opens a socket, runs SQL or calls a provider**. It has a separate `wrangler.pg-compat.toml` with Node compatibility, **no Cron Trigger** and **no database binding**. Existing scheduled production-disabled prototype is untouched.

## CI validation

- Run `node --test prototypes/cloudflare-commerce-cron/pg-compat.test.mjs` to validate driver import and fail-closed behaviour.
- Run a **local Wrangler build-only dry run**:
  `npm exec --yes --package=wrangler@4.45.0 -- wrangler deploy --dry-run --config prototypes/cloudflare-commerce-cron/wrangler.pg-compat.toml --outdir /tmp/cyph1-pg-compat-output`
- `--dry-run` is a compile operation, **not a deployment**. No Cloudflare API resource creation or account access is permitted by this task. CI needs ordinary npm registry access to obtain the pinned CLI; failure to download CLI is inconclusive for driver compatibility.
- Node `pg` import and Wrangler bundling must **both** pass to declare *build compatibility*. They do not validate Hyperdrive, transaction semantics, CPU usage, a real database connection, production readiness or webhook/send reliability.
- A dry-run bundle of `pg` is only a first screening step: existing commerce repositories depend on `pg.Pool`, SQL transactions and `FOR UPDATE SKIP LOCKED` and will require their own later isolated Cloudflare-compatible harness.

## Deliberate restrictions

No Hyperdrive configuration has been created or added, no production database or connection string has been used, no additional production services are needed, and no real Brevo/fulfilment events can be sent by this probe. The five-minute Cron configured in the earlier prototype is not part of the build-only probe and remains undeployed.

**Next conditional step:** after green local bundle CI, request separate approval for non-production Hyperdrive/disposable PostgreSQL tests with transactional claims, TLS, platform limits and read-cache restrictions. `COMMERCE_CRON_ENABLED` remains disabled and production GO/NO-GO remains blocked.
