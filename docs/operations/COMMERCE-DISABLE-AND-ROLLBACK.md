# Commerce disable and rollback

**Status:** Pre-production engineering baseline; production rehearsal and accountable approval outstanding  
**Scope:** Public presentation, checkout initiation, commerce runtime, protected operations and database recovery

## Safety rule

Stopping new checkouts and recovering existing orders are separate concerns.
Disable the customer entry point first, then preserve verified payment webhooks,
reconciliation and protected operations wherever they remain trustworthy. Do
not suspend an entire commerce runtime merely to hide checkout if doing so would
also prevent an in-flight payment from being recorded.

The current public pre-launch deployment contains no commerce routes. The
current Render staging listener exposes only generic health/readiness and
protected `/operations/*` routes; it does not expose checkout or webhooks.

## Existing controls

| Control | Effect | Activation characteristic |
| --- | --- | --- |
| `PUBLIC_COMMERCE_UI_ENABLED=false` or omitted | Omits the private checkout route and its browser code from the Astro build | Build-time; rebuild and redeploy the static site |
| `COMMERCE_ENABLED=false` | Makes `CheckoutService.initiate` fail closed even when a presentation route exists | Server-side environment change followed by runtime restart/redeploy |
| `PAYMENT_PROVIDER=disabled` | Prevents the payment dependency from satisfying commerce enablement | Server-side environment change |
| `FULFILMENT_MODE=disabled` and `FULFILMENT_PROVIDER=disabled` | Prevent the fulfilment dependencies from satisfying commerce enablement | Server-side environment change |
| Remove an operator from `OPERATIONS_ACCESS_GRANTS` | Denies that identity at the application boundary | Server-side environment change |
| Remove the Cloudflare Access Allow policy | Denies all browser access to protected operations | Edge change; use only for an operations-access incident |
| Suspend the current Render operations service | Stops protected operations, health and readiness | Last-resort staging containment; it is not a checkout kill switch |

Browser-facing `PUBLIC_` flags are presentation controls, not security
controls. A safe disablement always includes the server-side commerce gate.

## Immediate containment

1. Record the UTC start time, affected environment, deployed commit and reason.
2. Set `COMMERCE_ENABLED=false` in the affected commerce runtime and apply the
   provider's required restart or redeploy.
3. Confirm new checkout initiation receives the disabled/not-found response and
   cannot create an order or provider payment.
4. Set `PUBLIC_COMMERCE_UI_ENABLED=false` or remove it from the public build
   environment, rebuild and redeploy. Confirm no checkout route, button or
   commerce client bundle is published.
5. Leave verified webhook ingestion, reconciliation and protected operations
   available for in-flight attempts unless those components are themselves
   compromised. If the future deployment combines checkout and webhook routes,
   use a deployment that gates checkout initiation independently before launch.
6. If operations identity is implicated, remove the affected application grant
   and Access Allow policy. Do not add a bypass or Everyone rule to restore
   availability.
7. Preserve provider and application evidence. Never copy access assertions,
   API keys, full addresses or payment details into an issue or incident note.

## Source rollback

Use a source-controlled revert so the deployed service and repository remain
consistent.

1. Identify the last known-good commit and the faulty commit on the deployed
   branch.
2. Create a new revert commit. Do not force-push, reset `main` or rewrite a
   deployed branch.
3. Run the normal checks and deploy that exact revert through the existing
   workflow/provider integration.
4. Confirm the provider reports the expected commit and successful deployment.
5. Verify the public and server-side disable controls remain in their intended
   state after rollback; a code rollback must not accidentally re-enable
   commerce.

For the GitHub Pages site, follow the deployment verification in
`HOSTING-AND-DEPLOYMENT.md`. For Render, retain the service event and deploy-log
timestamps and check `/health` and `/ready` after the replacement deployment.

## Database rule

Application rollback does not authorise database rollback.

- Never delete orders, payments, refunds, webhook deliveries, fulfilment
  commands, communication deliveries or audit records to make a rollback pass.
- Never manually reverse an applied migration in the live database.
- Prefer a compatible application revert or a reviewed forward-fix migration.
- Stop mutations if the deployed application is incompatible with the schema.
- Treat backup restoration as a separate data-recovery incident. Establish the
  restore point, recovery-time objective, affected writes and reconciliation
  plan before restoration.
- After any database recovery, run the migration status and schema verification
  commands against the restored environment before permitting mutations.

## Recovery verification

Before re-enabling checkout:

1. Confirm the cause and affected time window are recorded.
2. Confirm the deployed commit, database migration checksums and runtime
   configuration match the approved recovery state.
3. Confirm `/health` and `/ready` pass without exposing diagnostic detail.
4. Reconcile every checkout or provider payment created during the affected
   window, including ambiguous and pending attempts.
5. Confirm verified webhooks are processed idempotently and no fulfilment action
   occurred without a captured payment.
6. Confirm protected operations still requires Cloudflare Access and the
   application JWT boundary.
7. Run the commerce test and security suites and complete a synthetic sandbox
   checkout only when the payment-provider exercise is authorised.
8. Obtain accountable approval before changing `COMMERCE_ENABLED` back to
   `true`. Re-enable the public UI only after the server gate is healthy.

## Evidence record

Record only privacy-safe evidence:

- incident or exercise identifier;
- UTC disable, deploy, recovery and re-enable times;
- environment and source commit identifiers;
- operator role, not personal contact details;
- affected route category and safe request/correlation identifiers;
- provider reconciliation result;
- migration and test results;
- approver role and outstanding follow-up actions.

## Current limitations

This runbook does not approve production commerce. Before production launch,
the deployed customer runtime must demonstrate that checkout initiation can be
disabled without disabling authenticated payment webhooks or reconciliation.
A controlled disable, rollback and recovery rehearsal must then be performed in
staging and recorded in the launch-readiness register.
