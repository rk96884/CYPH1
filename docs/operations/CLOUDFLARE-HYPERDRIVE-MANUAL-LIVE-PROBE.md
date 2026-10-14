# PR #147 — Controlled Hyperdrive manual invocation (PREPARATION ONLY)

Cloudflare configuration `cyph1-hyperdrive-development` exists, but the user has **not yet demonstrated a successful Cloudflare-to-Render connection**. Render read-only query confirmed that `cyph1_commerce_development` contains the isolated probe table with zero rows (2026-10-14).

This PR introduces an **isolated manual test entrypoint** that delegates to PR #146's single SELECT count/identity query. It has a hard-coded manual event marker, `HYPERDRIVE_PROBE_ENABLED=false`, no active Hyperdrive binding, no registered cron, and always returns 404 for HTTP. It has no payment, email, fulfilment or commerce code.

## When a future deployment/test is separately approved

1. Verify the existing Hyperdrive config `cyph1-hyperdrive-development` uses **only** the restricted role `cyph1_hyperdrive_probe` and the Render **development** database, without SQL caching. Verify encrypted TLS with certificate validation and review Render network exposure and Free plan usage.
2. Obtain the actual Hyperdrive configuration ID from Cloudflare (an identifier, not the origin password). Add `[[hyperdrive]] binding = "HYPERDRIVE"` to **this dedicated test Wrangler file only**, in an approved follow-up change. Do not use production credentials, public HTTP test endpoints or any live commerce worker config.
3. Establish a restricted manual invocation procedure using an approved, local/remote test runner; prove it produces the exact `event.cron = "__manual_hyperdrive_test__"` value. **Do not assume the Workers test-scheduled endpoint supplies this marker**; verify the Cloudflare tooling API before attempting the test.
4. Enable the test gate **only for the approved, explicitly invoked run**, with access and invocation restrictions. Since there are no Cron triggers, this must never run periodically. Immediately disable the gate afterwards.
5. Capture success/failure, CPU time, wall time, Hyperdrive query counts and TLS verification evidence; redact all credentials and connection strings. Confirm one read-only query and no changes to real commerce tables. Remove/decommission temporary resources after testing.

## Safety limitations

The test code rejects any non-manual scheduled event. The gate defaults to disabled and no remote access is configured. **A deployment, a binding, and an actual invocation are not created in this PR.** A green CI build proves bundle/test behaviour only, not working Hyperdrive, CPU budget, TLS or zero additional cost.

Any future staging data-writing/concurrency tests require another approval. Customer-facing production flags remain disabled.
