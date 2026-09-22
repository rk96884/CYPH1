# Terminal worker failure ownership and alerting

**Status:** Engineering monitor implemented; synthetic rehearsal and notification-route evidence outstanding  
**Owner before production:** CYPH/1 commerce operations owner, with a named deputy required before launch.

## Alert condition

The monitor fails when either fulfilment payment-event processing or transactional communication delivery has reached terminal `retry_exhausted`. It emits only aggregate counts and the age of the oldest outstanding failure. Customer identity, email, address, order contents, payment details and provider references must not be written to GitHub Actions logs.

The staging workflow runs four times per hour and may also be dispatched manually. A green run means no current `retry_exhausted` rows were found; it does not prove providers are healthy.

## Response

A failed monitor run requires acknowledgement by the commerce operations owner or deputy. Investigation must occur through authorised operational access, not by adding identifiers to the public workflow log.

Determine whether a provider side effect may already have occurred before any replay. Do not automatically retry a terminal job. For fulfilment, confirm payment/order state and provider state before a permission-controlled replay. For communications, confirm provider delivery state and the stable deduplication/idempotency key before replay.

Record the investigation, decision, authorised operator, correlation/audit evidence and closure in the restricted operational incident record. Escalate ambiguous provider state rather than assuming failure or success.

## Launch gates

- [x] Privacy-safe aggregate monitor implemented.
- [x] Scheduled GitHub Actions failure signal defined at approximately 15-minute intervals.
- [ ] Configure the development database secret for the workflow.
- [ ] Pass zero-state, synthetic terminal-failure detection and post-cleanup green rehearsal.
- [ ] Verify the GitHub notification route reaches the accountable owner/deputy.
- [ ] Name and accept production owner/deputy and response expectations.
- [ ] Verify selected external providers' idempotency behaviour.
