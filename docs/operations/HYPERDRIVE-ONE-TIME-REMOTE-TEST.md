# One-time Hyperdrive remote test — run only after PR is green and merged

Cloudflare's remote Wrangler development runs in Cloudflare infrastructure and connects to the configured **development** Hyperdrive, unlike local emulation. The existing binding is `05becdcb7b9041b297568df15553518f`; no secrets required in git.

**Preconditions:** confirm the Cloudflare Hyperdrive origin is `cyph1_commerce_development`, restricted role `cyph1_hyperdrive_probe`, TLS verified, caching off. This test invokes one read-only SELECT against the isolated table. No live checkout, transactional emails, payments or fulfilment. The process will incur limited Cloudflare free-tier usage.

From a Windows PowerShell terminal in your local **CYPH1 repository root**, after `git pull` and `npm ci`:

1. If not authenticated: `npx wrangler@4.45.0 login`.
2. In **terminal A** start one temporary session (no permanent deployment or recurring cron):
   ```powershell
   npx wrangler@4.45.0 dev --remote --test-scheduled --var HYPERDRIVE_PROBE_ENABLED:true --config prototypes/cloudflare-commerce-cron/wrangler.hyperdrive-manual-test.toml
   ```
3. In **terminal B**, **once**, request only the manual test event:
   ```powershell
   Invoke-WebRequest 'http://127.0.0.1:8787/__scheduled?cron=__manual_hyperdrive_test__'
   ```
   Wrangler documentation has also described `/cdn-cgi/local/scheduled` in some releases; if the first URL returns 404, consult the local Wrangler output for the actual **test-scheduled endpoint** before retrying. Never expose the endpoint outside localhost.
4. In terminal A, expect a sanitized log like `{"event":"hyperdrive_manual_probe","status":"verified","jobCount":0}`. Any `disabled` or `not_manual_test` outcome means the query was **not** run; exceptions mean the connection/test failed. Do not paste connection strings or credential-bearing error logs into chat.
5. Press **Ctrl+C** in terminal A immediately after one test. Verify Cloudflare Hyperdrive dashboard query count and CPU usage. No ongoing scheduled processing exists.

**NOTE:** `wrangler dev --remote` executes code on Cloudflare's network and accesses the configured remote development database. Do not run until you are comfortable with that isolated read-only access. Because `HYPERDRIVE_PROBE_ENABLED` is overridden only by CLI `--var`, repository configuration stays disabled.

Official references:
- https://developers.cloudflare.com/hyperdrive/configuration/local-development/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/workers/examples/cron-trigger/
