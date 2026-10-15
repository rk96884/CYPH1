# Real PostgreSQL isolated fulfilment-outbox test

No production connection, email, order, payment or fulfilment action. The Node test fails closed unless `CYPH1_RUN_ISOLATED_OUTBOX_TEST=YES` and the connected database is exactly `cyph1_commerce_development`. It creates a uniquely named disposable schema containing a minimal synthetic table and drops it in a finally block. It does **not** use the real `public.outbox_events` table or change the 53 pre-existing pending development events.

The test uses two separate real PostgreSQL connections and `FOR UPDATE SKIP LOCKED`, simulates a stale claim token and recovery, and simulates retry exhaustion. It verifies the SQL invariants, not the full real fulfilment provider's end-to-end behaviour. Existing mock tests continue validating the actual outbox consumer logic.

After PR and CI validation, an operator with development database credentials can run from the repository root:

```powershell
git pull origin main
npm ci
$env:CYPH1_RUN_ISOLATED_OUTBOX_TEST = "YES"
$env:CYPH1_DEVELOPMENT_DATABASE_URL = "<private development DATABASE URL>"
node .\prototypes\cloudflare-commerce-cron\run-isolated-outbox-test.mjs
Remove-Item Env:\CYPH1_DEVELOPMENT_DATABASE_URL
Remove-Item Env:\CYPH1_RUN_ISOLATED_OUTBOX_TEST
```

Never post the database URL into ChatGPT or commit it. Since the test performs disposable **development writes** (CREATE/DROP SCHEMA), run it only with owner authorization. This test does not apply the production migration or activate Cloudflare Cron.
