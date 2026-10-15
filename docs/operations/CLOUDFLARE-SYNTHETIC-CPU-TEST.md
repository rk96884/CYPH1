# Cloudflare synthetic CPU trial

Uses the **actual compiled `TransactionalCommunicationConsumer` and email templates** but fake in-memory repository/provider. No real DB, Hyperdrive, email send, Brevo API call, payment, or fulfilment operation. Default disabled; no HTTP endpoint and no Cron trigger.

After GitHub CI passes and PR is merged, in Windows PowerShell from CYPH1 root:
```powershell
git pull origin main
npm ci
npm run build:runtime --workspace @cyph1/commerce-api
npx wrangler dev --remote --test-scheduled --var SYNTHETIC_CPU_TEST_ENABLED:true --config .\prototypes\cloudflare-commerce-cron\wrangler.synthetic-cpu.toml
```
In a second PowerShell terminal **once**:
```powershell
Invoke-WebRequest 'http://127.0.0.1:8787/__scheduled?cron=__manual_synthetic_cpu_test__'
```
Expect log `{"event":"synthetic_commerce_cpu_probe","status":"verified","wallMs":...}`. Then immediately stop Wrangler with Ctrl+C. `wallMs` is **not CPU usage**. Check per-invocation CPU if the Cloudflare developer session makes it available; account-wide CPU totals cannot verify the Free tier 10ms per-invocation budget. If no per-invocation CPU is exposed, report it as unmeasured rather than claiming a pass.

This probe tests email consumer and rendering only; not DB-backed repository, fulfilment queue processing or full live job time. No production approval implied.
