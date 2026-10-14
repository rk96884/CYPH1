# PR #146 — Read-only Hyperdrive connectivity test (preparation only)

Verified 2026-10-14 through Render read-only SQL: `cyph1_commerce_development` contains `cyph1_hyperdrive_probe.cyph1_hyperdrive_probe_jobs` with **zero rows**.

This PR adds an isolated `pg` Worker module for a single read-only query, and a Wrangler **build-only** config with **no live Hyperdrive binding, no Cron schedule, and no HTTP test endpoint**. The explicit `HYPERDRIVE_PROBE_ENABLED=false` gate prevents the probe from making calls by default. The Worker exports `runReadOnlyProbe` to invoke only in a separately authorised test harness; the exported scheduled/fetch handlers deliberately do not call it.

## Explicit approval required before any live connection

1. Confirm the Cloudflare Hyperdrive configuration is bound solely to Render **development** with the restricted role `cyph1_hyperdrive_probe`, caching disabled, a validated TLS certificate and no production host. Do not copy credentials into chat or GitHub.
2. Check Render access policy, Cloudflare Workers Free CPU allowance and Hyperdrive free query quota. Hyperdrive configuration existing does not establish successful connectivity.
3. Prepare a **separate, temporary, explicitly authorised invocation mechanism** for `runReadOnlyProbe`. Do not add a publicly callable URL by default. Review identity/access control, timeout and suppression of secrets in logs.
4. Provide the actual configuration binding ID securely as an identifier (not a DB password). Add `[[hyperdrive]]` only in a separately reviewed deployment change.
5. Execute exactly the single synthetic-table read-only query, verify returned database identity, measure CPU/query count and review logs with secret redaction.
6. Disable/remove the temporary test resources and binding after validation.

**This PR does not deploy any Worker, bind Hyperdrive, schedule any events, execute SQL on Cloudflare, turn on payments, send emails or touch fulfilment.** CI runs mocked tests and Wrangler dry-run bundling only. Passing CI is not evidence of real Hyperdrive runtime success.
