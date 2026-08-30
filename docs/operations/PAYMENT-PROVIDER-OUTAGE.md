# Payment-provider outage and ambiguous checkout

**Scope:** Private/test commerce only until launch approval  
**Safety rule:** Never create a second payment attempt while the first attempt may exist at the provider.

## Automatic behaviour

- Definitive provider rejection cancels the draft order and fails the checkout session.
- A timeout, network interruption, rate limit or retryable provider failure leaves the order in `draft` and marks the checkout session `resolution_required`.
- Reuse of the same idempotency key is blocked until the ambiguous outcome is resolved.
- The public commerce feature remains disabled; this process does not authorise live payments.

## Operator procedure

1. Disable new checkout if failures are sustained or the provider reports an incident.
2. Identify `resolution_required` sessions and retain their order ID, order number, correlation ID and idempotency key.
3. Query the provider using the original order reference or idempotency evidence. Do not infer payment state from a browser redirect.
4. If a payment exists, reconcile it through the authenticated webhook/payment workflow before permitting fulfilment.
5. If the provider confirms no payment exists, record that evidence before abandoning the draft and allowing a new attempt with a new key.
6. Escalate any captured payment without a matching order to the incident owner; do not fulfil or refund by editing the database.
7. After recovery, reconcile all provider payments, orders and refunds for the affected period and record the incident timeline.

## Recovery evidence

- Provider incident start/end and status link or support reference.
- Affected checkout-session and order IDs (never payment credentials).
- Resolution decision and operator identity for every ambiguous session.
- Reconciliation result and confirmation that checkout was deliberately re-enabled.

