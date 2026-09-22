# Terminal worker failure ownership and alerting

**Status:** Development monitoring, synthetic detection rehearsal and GitHub notification-route rehearsal complete; production ownership and provider idempotency remain outstanding  
**Owner before production:** CYPH/1 commerce operations owner, with a named deputy required before launch.

## Alert condition

The monitor fails when either fulfilment payment-event processing or transactional communication delivery has reached terminal `retry_exhausted`. It emits only aggregate counts and the age of the oldest outstanding failure. Customer identity, email, address, order contents, payment details and provider references must not be written to GitHub Actions logs.

The staging workflow runs four times per hour and may also be dispatched manually. A green run means no current `retry_exhausted` rows were found; it does not prove providers are healthy.

## Response

A failed monitor run requires acknowledgement by the commerce operations owner or deputy. Investigation must occur through authorised operational access, not by adding identifiers to the public workflow log.

Determine whether a provider side effect may already have occurred before any replay. Do not automatically retry a terminal job. For fulfilment, confirm payment/order state and provider state before a permission-controlled replay. For communications, confirm provider delivery state and the stable deduplication/idempotency key before replay.

Record the investigation, decision, authorised operator, correlation/audit evidence and closure in the restricted operational incident record. Escalate ambiguous provider state rather than assuming failure or success.

## Development rehearsal evidence — 22 September 2026

The privacy-safe monitor passed against Render development at zero fulfilment and zero communication terminal failures. The guarded synthetic rehearsal then detected one terminal fulfilment failure and one terminal communication failure, emitted aggregate operational counts only, rolled back its synthetic records, and returned to a zero/zero state. No external provider was called.

After the workflow was merged to `main`, a manual GitHub Actions run completed green against Render development using the configured repository secret. A separate manual-only notification rehearsal ran the real database monitor first and then deliberately failed a final step without changing database state. The project owner received the GitHub failure notification. A final normal manual run with simulation disabled completed green, restoring the monitor to its ordinary operating state. Scheduled runs cannot enable the simulation input.

This proves the development alert path to the project owner. It does not appoint a production owner/deputy, define production response commitments, or prove external-provider idempotency.

## Launch gates

- [x] Privacy-safe aggregate monitor implemented.
- [x] Scheduled GitHub Actions failure signal defined at approximately 15-minute intervals.
- [x] Configure the development database secret for the workflow.
- [x] Pass zero-state, synthetic terminal-failure detection and post-cleanup green rehearsal.
- [x] Verify the GitHub notification route reaches the project owner in development.
- [ ] Name and accept production owner/deputy and response expectations.
- [ ] Verify selected external providers' idempotency behaviour.
