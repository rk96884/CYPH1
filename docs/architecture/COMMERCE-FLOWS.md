# CYPH/1 Checkout and Order Flows

## 1. Successful hosted checkout

```text
Customer        Astro site       Commerce API       Database       Provider
   |                 |                 |                |              |
   | add product     |                 |                |              |
   |---------------->| validate basket |                |              |
   |                 |---------------->| read product   |              |
   |                 |                 |--------------->|              |
   |                 |                 | create order   |              |
   |                 |                 |--------------->|              |
   |                 |                 | create checkout               |
   |                 |                 |------------------------------>|
   |                 | hosted URL      |                |              |
   |                 |<----------------|                |              |
   | redirect        |                 |                |              |
   |<----------------|                 |                |              |
   | pay on provider |                 |                |              |
   |--------------------------------------------------------------->   |
   | return pending  |                 |                |              |
   |<-----------------------------------------------------------------|
   |                 |                 | verified webhook              |
   |                 |                 |<------------------------------|
   |                 |                 | paid + outbox  |              |
   |                 |                 |--------------->|              |
```

The return page reads internal status. It does not infer success from query parameters or the redirect itself.

## 2. Duplicate webhook

1. Verify signature/authenticity before processing.
2. Attempt to insert `(provider, event_id)` into `webhook_events`.
3. If already processed, return a successful acknowledgement without repeating effects.
4. If previously failed transiently, acquire a processing lease and retry.
5. Commit payment transition, order transition and outbox events atomically.

## 3. Out-of-order webhook

An adapter may receive `payment.paid` before `payment.pending`, or an older update after a terminal event. State transition rules must:

- permit forward transitions supported by provider evidence;
- ignore stale transitions;
- never move a paid/refunded payment back to pending;
- record the ignored event for audit;
- query the provider when event evidence is contradictory.

## 4. Timeout while creating checkout

1. The API submits checkout creation with an idempotency key.
2. The provider response times out.
3. The payment attempt becomes `resolution_required`, not failed.
4. Retry with the same idempotency key or query the provider.
5. Return the recovered checkout if it exists.
6. Create a new attempt only after the original outcome is resolved or explicitly abandoned.

## 5. Payment failure or abandonment

- Keep the order `awaiting_payment` while the payment is genuinely pending.
- Mark the attempt failed/cancelled/expired from verified provider evidence.
- Release reserved inventory according to the approved reservation policy.
- Permit a new payment attempt for the same valid order.
- Do not send purchase confirmation or fulfilment instructions.

## 6. Payment succeeds after customer closes browser

The webhook still marks the order paid and triggers confirmation/fulfilment. Customer browser presence is irrelevant to authoritative processing.

## 7. Full or partial refund

1. An authorised operator selects a refundable payment and enters an approved reason.
2. The server revalidates refundable amount and permissions.
3. A refund record is created with an idempotency key.
4. The adapter submits the refund.
5. Provider webhook/query resolves the final state.
6. Order status changes only under explicit full/partial-refund rules.
7. Confirmation and reconciliation events are emitted once.

## 8. Cancellation

- Before payment: expire/cancel the payment attempt and release reservations.
- Paid but not dispatched: follow the approved void/refund and fulfilment-cancellation procedure.
- Dispatched: use the returns workflow rather than silently cancelling.

## 9. Fulfilment

```text
payment.paid
    |
    v
outbox: fulfilment.requested
    |
    v
fulfilment adapter --accepted--> fulfilment_pending
    |
    +--dispatched--------------> fulfilled + tracking event
    |
    +--failed------------------> manual_review + alert
```

An idempotency key prevents duplicate fulfilment creation.

## 10. Provider outage

- Stop new checkout creation when the configured provider is unavailable.
- Preserve existing orders and unknown payment outcomes.
- Continue accepting and retrying verified webhooks where possible.
- Do not automatically redirect an in-progress payment to another provider.
- Enable another provider only through an explicit operational decision and new payment attempt.
- Reconcile all uncertain attempts after recovery.

## 11. State-transition rules

Examples of permitted payment transitions:

```text
created -> pending -> authorised -> paid
created -> pending -> failed
created -> pending -> cancelled
created -> pending -> expired
paid -> partially_refunded -> refunded
paid -> dispute_opened -> dispute_resolved
```

Terminal-state exceptions must be provider-evidence driven and audited. Application code must not update state with unrestricted strings.
