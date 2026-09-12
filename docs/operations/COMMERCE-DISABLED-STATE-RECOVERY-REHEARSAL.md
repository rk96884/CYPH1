# Commerce disabled-state recovery rehearsal

**Status:** `CDR-DRILL-001` passed on 12 September 2026  
**Environment:** Customer staging runtime only  
**Safety constraint:** Checkout, payment webhooks, payments and fulfilment remain disabled throughout

## Purpose

This rehearsal proves that the customer staging runtime can be redeployed at an
approved source revision without weakening its fail-closed commerce state. It
is deliberately narrower than the future Mollie exercise: it does not enable a
checkout, submit a webhook, create an order or demonstrate continuity for an
in-flight payment.

## Preconditions

- The customer staging service is healthy and reports ready.
- Render identifies the deployed branch as `main` and the expected source
  commit is recorded.
- These customer staging variables are already set to their fail-closed values:
  - `CHECKOUT_HTTP_ENABLED=false`
  - `COMMERCE_ENABLED=false`
  - `PAYMENT_WEBHOOKS_ENABLED=false`
  - `PAYMENT_PROVIDER=disabled`
  - `FULFILMENT_MODE=disabled`
  - `FULFILMENT_PROVIDER=disabled`
- No variable value will be changed during the rehearsal.
- The operator has access to the Render deploy view and GitHub Actions.

Do not copy database URLs, secret values, Access assertions or personal data
into the evidence record.

## Procedure

Record all times in UTC.

1. Record the exercise identifier `CDR-DRILL-001`, start time, customer staging
   service name and currently deployed commit.
2. Run the dual-runtime staging monitor with both simulated-failure inputs set
   to `false`. Record the run number and confirm both jobs pass.
3. From PowerShell, verify the customer runtime is in the exact disabled route
   state:

   ```powershell
   $env:CUSTOMER_RUNTIME_ORIGIN = "https://commerce-staging.cyph1.co.uk"
   $env:CUSTOMER_ROUTE_GATE_MODE = "disabled"
   npm run verify:customer-route-gates
   ```

   The expected result is HTTP `404` for both `checkout` and `payment webhook`,
   followed by `Verified customer route-gate mode: disabled`.
4. In Render, open the customer staging service's **Manual Deploy** menu and
   choose **Deploy latest commit**. Do not choose an older commit and do not
   edit any environment variable.
5. Record the deployment start time, source commit and successful completion
   time. Confirm Render reports the service as live.
6. Re-run the command from step 3. Both routes must still produce the exact
   disabled result.
7. Re-run the dual-runtime staging monitor with both simulated-failure inputs
   set to `false`. Record the run number and confirm both jobs pass.
8. Remove the temporary shell variables:

   ```powershell
   Remove-Item Env:CUSTOMER_ROUTE_GATE_MODE
   Remove-Item Env:CUSTOMER_RUNTIME_ORIGIN
   ```

9. Record the outcome and any unexpected behaviour. If a route is exposed or
   readiness fails, stop the rehearsal, retain the fail-closed variable values
   and follow `COMMERCE-DISABLE-AND-ROLLBACK.md`.

## Pass criteria

- The pre-deploy and post-deploy monitor runs both pass for customer and
  operations staging.
- Render deploys the recorded latest commit successfully.
- `/checkout` and `/webhooks/mollie` return the exact expected disabled response
  before and after deployment.
- No enablement variable changes, state-changing requests or database records
  are involved.
- Evidence contains identifiers, UTC times and outcomes only.

## Evidence record

| Field | Result |
| --- | --- |
| Exercise identifier | `CDR-DRILL-001` |
| Exercise date | 12 September 2026 |
| Operator role | Project owner |
| Initial deployed commit | `9e36f9e` |
| Pre-deploy monitor run | GitHub Actions commerce staging monitor run `#85`; customer and operations jobs passed |
| Pre-deploy route-gate result | Passed; checkout HTTP `404`, payment webhook HTTP `404`, exact disabled mode verified |
| Replacement deployment commit | `9e36f9e` (unchanged) |
| Render deployment result | Passed; manual latest-commit deployment completed in 41.9 seconds and reported Live at 15:24:59 UTC on 12 September 2026 |
| Post-deploy route-gate result | Passed; checkout HTTP `404`, payment webhook HTTP `404`, exact disabled mode verified |
| Post-deploy monitor run | GitHub Actions commerce staging monitor run `#87`; customer and operations jobs passed |
| Commerce flags changed | No |
| State-changing requests made | No |
| Outcome | Passed; the same approved commit was redeployed and the fail-closed route state was preserved |
| Follow-up actions | Source-controlled faulty-release rollback and Mollie checkout-disable/webhook-continuity exercises remain open |

## Remaining launch exercise

Passing this rehearsal proves only disabled-state preservation through a
replacement deployment. It does not close the source-controlled faulty-release
rollback gate or the Mollie checkout-disable/webhook-continuity gate. Those
exercises remain blocked until a reviewed synthetic release and Mollie test
account are available; neither may use real customer data or a live payment
method.
