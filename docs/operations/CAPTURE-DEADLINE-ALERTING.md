# Capture deadline operator alerting

**Status:** notification route defined on the Klarna/Mollie feature branch; manual rehearsal and production scheduling remain outstanding.  
**Owner before production:** CYPH/1 commerce operations owner, with a named deputy required before customer enablement.

## Purpose

The capture-deadline monitor protects manually captured authorised payments from silently approaching or passing the provider's authoritative `captureBefore` deadline. It never captures a payment. Capture remains available only through the protected `payments:capture` operation and fulfilment remains gated on a verified captured payment.

## Human notification route

CYPH/1 reuses the existing GitHub Actions operational-failure notification pattern already rehearsed for terminal worker failures. `.github/workflows/commerce-capture-deadline-monitor.yml` is deliberately **manual-only** at this stage: no production or staging schedule is installed by this change.

A normal workflow dispatch builds the commerce runtime and runs `npm run monitor:capture-deadlines`. The monitor returns non-zero for any actionable condition or for monitor/configuration failure, causing the GitHub Actions run to fail and use the repository owner's existing GitHub workflow-failure notification route.

The workflow itself does not print customer identity, email, address, order contents, raw provider responses, credentials or provider error messages. Investigation must happen through protected operations/audit access.

### Severity decision

For initial launch readiness, `warning` uses the same GitHub failure-notification route as `critical`, `overdue`, `missing_deadline` and `reconciliation_required`. This is intentionally conservative while volumes are low and avoids building a second notification system solely for lower severity. `safe` never causes an alert.

Escalation from warning to critical or overdue is retained in the database/outbox/audit state as a distinct condition. The workflow may remain failed while an unchanged condition persists; GitHub/run-level incident grouping should therefore be used rather than treating every poll as a new payment incident when scheduling is later approved.

## Notification-route rehearsal

The workflow has a manual `rehearsal_condition` choice: `warning`, `critical`, `overdue`, `missing_deadline` or `reconciliation_required`. Selecting one deliberately fails the workflow with a privacy-safe synthetic message. It does **not** connect to the database, call Mollie, alter a payment, capture funds or release fulfilment.

This rehearsal proves only that a workflow failure for the named capture-deadline condition reaches the configured GitHub notification destination. It does not prove the database monitor or provider integration; those are covered separately by the capture-deadline unit/PostgreSQL rehearsals.

Before scheduling, manually dispatch at least `critical` and `overdue`, confirm the project owner receives the GitHub failure notification, then dispatch `none` against the approved staging configuration and confirm the real monitor completes as expected.

## Required GitHub secrets for a real staging monitor run

- `COMMERCE_DEVELOPMENT_DATABASE_URL`
- `MOLLIE_TEST_API_KEY`
- `COMMERCE_CUSTOMER_STAGING_ORIGIN`

The workflow fixes `PAYMENT_PROVIDER=mollie-test`, `DATABASE_SSL=true`, warning at 1440 minutes, critical at 360 minutes and a maximum of 100 payments for this staging verification route. Production configuration and a production database secret must be designed and approved separately; do not repoint the development workflow at production.

## Operator response

For a warning or critical condition, use protected operations to identify the CYPH/1 payment/order and verify the current provider state and authoritative deadline. Confirm fulfilment readiness before invoking the protected capture operation. Urgency alone is not authority to capture.

For overdue, missing-deadline or reconciliation-required conditions, withhold capture and fulfilment until authoritative provider state is reconciled. Do not invent or manually extend a deadline, clear a capture reservation, retry an ambiguous capture, or use another idempotency key to work around an unresolved command.

If the notification workflow itself fails because configuration, database connectivity or provider access is unavailable, treat that as loss of monitoring coverage. Investigate the workflow/runtime configuration; do not compensate by automatically capturing payments.

## Deduplication and privacy

Payment-level alert deduplication remains in the capture-deadline monitor/outbox implementation: the same payment, canonical deadline and condition do not create uncontrolled duplicate outbox/audit events, while a real escalation can create a new condition event. The GitHub workflow is a human signalling layer over the monitor exit status, not a second payment-event store.

No customer PII is required in GitHub Actions logs. Payment/order/provider references belong in restricted operational records and protected investigation surfaces, not workflow output.

## Launch gates

- [x] Capture-deadline conditions and provider reconciliation implemented.
- [x] Monitor cannot invoke provider capture.
- [x] Privacy-safe GitHub Actions notification route defined.
- [x] Manual synthetic warning/critical/overdue/missing/reconciliation rehearsal controls defined.
- [ ] Configure/verify the required GitHub staging secrets.
- [ ] Run synthetic `critical` rehearsal and confirm notification reaches the project owner.
- [ ] Run synthetic `overdue` rehearsal and confirm notification reaches the project owner.
- [ ] Run a normal staging monitor dispatch after migrations through `0012` are applied.
- [ ] Approve production owner/deputy and response expectations.
- [ ] Design and approve the production database/provider secret boundary.
- [ ] Approve a production/staging cadence comfortably inside the critical window.
- [ ] Create the schedule only after the alert route and live staging monitor have been verified.
