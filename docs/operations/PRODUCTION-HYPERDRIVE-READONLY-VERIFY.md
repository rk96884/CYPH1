# Production Hyperdrive read-only verification

After approval and successful CI, use **temporary Wrangler remote development**, not deploy, to confirm the new production Hyperdrive configuration resolves to `cyph1_commerce_production` using role `cyph1_hyperdrive_prod_worker`. Query is only `SELECT current_database(), current_user`; no commerce table reads, data changes, provider calls, Cron triggers or public route.

From CYPH1 root (Windows PowerShell), after merge:
```powershell
git pull origin main
npm ci
npx wrangler dev --remote --test-scheduled --var PRODUCTION_HYPERDRIVE_READONLY_PROBE:true --config .\prototypes\cloudflare-commerce-cron\wrangler.production-hyperdrive-readonly.toml
```
In a second PowerShell window, once:
```powershell
Invoke-WebRequest 'http://127.0.0.1:8787/__scheduled?cron=__manual_production_hyperdrive_readonly__'
```
Expect only `{"event":"production_hyperdrive_readonly","status":"verified"}` in Wrangler. Stop with Ctrl+C. Any other outcome means do not proceed.

Before considering any live processing, confirm Cloudflare Hyperdrive origin TLS/certificate configuration and least-privilege table grants. This identity probe does not prove either. Production checkout/payments/emails/fulfilment remain disabled.
