# Cloudflare Scheduled Commerce Worker — non-production prototype

**Not approved for deployment.** This minimal runtime can be tested with `node --test prototypes/cloudflare-commerce-cron/worker.test.mjs` and needs no dependencies, credentials, database or Brevo.

`wrangler.toml` declares a **5-minute trigger** but has no binding to the production PostgreSQL database, Hyperdrive, Brevo, payments or fulfilment. It deliberately uses `workers_dev = false` and `COMMERCE_CRON_ENABLED = "false"`. **Do not deploy this configuration just because the PR is merged.**

The default scheduled handler returns `disabled`, with no DB/HTTP calls. Manually switching the flag to `true` **fails closed**: the integration is not implemented. The public HTTP handler always returns 404.

Next separate, owner-approved phases: check Cloudflare free limits and costs; test pg/Hyperdrive bundling against disposable non-production DB; prove transaction locking, CPU allowance and timeouts; design bounded batches and interrupted/uncertain-send semantics using existing repository safeguards; approve release and monitoring. Production secrets, connections and email delivery require independent approval. See `docs/operations/CLOUDFLARE-SCHEDULED-COMMERCE-FEASIBILITY.md`.
