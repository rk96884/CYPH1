# Refunds, returns, cancellations and disputes

**Scope:** Private/test commerce until controlled-launch approval.  
**Principle:** Provider and fulfilment state must be reconciled; browser messages and manual database edits are not evidence.

## Refunds

- Use an approved reason, an explicit minor-unit amount and a unique idempotency key.
- Recheck the provider's authoritative refundable balance before requesting a refund.
- A completed partial refund reduces the remaining refundable balance; a full refund closes it.
- A timeout or retryable provider failure is `resolution_required`, not failed. It continues to reserve that amount so another request cannot over-refund the payment.
- Resolve an ambiguous refund by querying the provider using the original payment, order and idempotency references. Do not submit a replacement until the provider confirms the first request did not create a refund.

## Cancellations and returns

- Cancellation is automatic only before dispatch; after dispatch it requires review.
- A return request is automatic only after dispatch; pre-dispatch requests use cancellation instead.
- Provider commands carry stable idempotency keys. Repeated operator actions must not create duplicate cancellations or returns.
- A returned fulfilment does not itself prove that a refund completed; the two records must be reconciled separately.

## Disputes

- `dispute.opened` may advance a captured, partially refunded or refunded payment to dispute review.
- A repeated event is ignored safely.
- A resolution received without a recorded opening event requires manual review; do not silently overwrite payment state.
- Preserve provider evidence, deadlines and operator actions in the audit trail. Never represent a dispute as resolved solely from a customer-facing redirect or email.

## Exercise checklist

1. Complete one partial and one full sandbox refund and reconcile provider, payment, order and communication records.
2. Interrupt a refund request after submission and confirm the amount remains reserved in `resolution_required`.
3. Exercise cancellation before dispatch and verify cancellation after dispatch is blocked.
4. Exercise return after dispatch and verify return before dispatch is blocked.
5. Replay dispute events and send them out of order; verify duplicates are ignored and unsafe transitions require review.
6. Record the evidence in the launch-readiness register. Do not enable production commerce.
