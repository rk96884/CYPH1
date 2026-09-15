# Customer staging faulty-release recovery rehearsal

**Exercise:** `CDR-DRILL-003`  
**Status:** Prepared; temporary faulty-release commit not yet deployed  
**Scope:** Customer staging runtime only  
**Safety:** Checkout, payment webhooks, commerce, payments and fulfilment remain disabled

## Objective

Demonstrate that a compatible but observably faulty customer-runtime release is
detected and recovered through a new source-controlled revert commit. The
temporary release changes only the generic `GET /health` JSON from
`{"status":"ok"}` to `{"status":"degraded"}` while retaining HTTP `200`.
This allows Render to run the revision while the exact-response GitHub monitor
detects the fault.

The exercise must not change the database, issue a checkout request, submit a
webhook, contact a payment or fulfilment provider, rewrite branch history, or
deploy to production.

## Preconditions and stop conditions

Before deploying, confirm customer staging retains:

- `CHECKOUT_HTTP_ENABLED=false`;
- `PAYMENT_WEBHOOKS_ENABLED=false`;
- `COMMERCE_ENABLED=false`;
- `PAYMENT_PROVIDER=disabled`;
- `FULFILMENT_MODE=disabled`; and
- `FULFILMENT_PROVIDER=disabled`.

Stop if the revision contains unrelated changes, either commerce route becomes
available, the operations runtime becomes unhealthy, or recovery would require
a database/configuration change. Do not use force-push, reset, database edits or
provider actions to recover.

## Exercise sequence

1. Record the current UTC time, current `main` commit, customer Render service
   and last successful dual-runtime monitor run.
2. Run the local checks listed below.
3. Commit the temporary source and test as one focused commit, push `main`, and
   deploy that exact commit to **customer staging only**.
4. Confirm `GET /health` returns HTTP `200` with exactly
   `{"status":"degraded"}`. Do not use `/ready` as the injected failure.
5. Run **Commerce staging monitor** without selecting `simulate_failure`.
   Expected result: `customer-health-and-readiness` fails on the unexpected
   health body; `operations-health-and-readiness` passes.
6. Confirm `npm run verify:customer-route-gates` still reports checkout and
   payment webhook as HTTP `404` in disabled mode.
7. Create a new `git revert <temporary-commit>` commit. Do not reset or
   force-push. Push and deploy the revert commit to customer staging.
8. Confirm customer `/health` returns HTTP `200` with exactly
   `{"status":"ok"}` and `/ready` returns HTTP `200` with exactly
   `{"status":"ready"}`.
9. Repeat the disabled route-gate verification and run the dual-runtime monitor.
   Both jobs must pass.
10. Record commit IDs, Render deployment times, monitor run numbers, route-gate
    results, notification receipt and any deviation below.

## Local checks before the temporary commit

```powershell
npm run check:commerce
npm run test:commerce
npm run test:staging-monitor
npm run test:customer-route-gates
npm run audit:commerce-security
```

## Evidence record

| Check | Result |
| --- | --- |
| Last known-good commit | Pending |
| Temporary faulty-release commit | Pending |
| Customer staging deployment | Pending |
| Injected `/health` result | Pending |
| Fault monitor run and notification | Pending |
| Operations job remained healthy | Pending |
| Fault-deploy route gates | Pending |
| Source-controlled revert commit | Pending |
| Revert deployment | Pending |
| Recovered `/health` and `/ready` | Pending |
| Recovered route gates | Pending |
| Final dual-runtime monitor | Pending |
| Database/configuration/provider changes | None permitted |

Passing this rehearsal demonstrates detection and source recovery for a
compatible application fault only. It does not test database migration
rollback, in-flight payments, webhook continuity or production approval.
