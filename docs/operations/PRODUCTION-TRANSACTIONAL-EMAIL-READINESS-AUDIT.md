# EM-01 — Production transactional email readiness audit

**14 October 2026 | READ-ONLY DOCUMENTATION | NO LIVE SENDING AUTHORITY**

This reconciles the existing Brevo worker and adapter implementation with the launch-control register. This review neither connects to Brevo/Render production accounts nor sends messages, enables workers, modifies environment variables, or assumes production mail has been tested.

## Development status clarification — 21 October 2026

**Transactional email feature development: COMPLETE / AUTOMATED-TEST VERIFIED.** Four HTML/text templates, Brevo adapter, communications ledger, retry/idempotency safeguards and consumer code already exist. The owner reports the work as completed; do not re-open implementation without a specific defect.

**Operational evidence is separate:** The 14 October audit did not confirm a deployed commerce worker or genuine Brevo transactional delivery. Later Cloudflare bounded-worker code (through merged PR #162) supersedes the assumption that a Render worker is the only route, but PR #162 explicitly records no deployment, Cron or sending. Confirm the actual production worker, gates and provider delivery in final QA, rather than calling the feature missing.

## Existing verified engineering evidence

- Four visually draft-approved HTML/text templates from merged PR #90: order confirmation following `payment.paid`, dispatch following `fulfilment.dispatched`, cancellation following authoritative cancellation, and refund following `refund.completed`.
- `apps/commerce-api/src/communications/brevo.ts` implements bounded API transport with separate sender and reply-to, an idempotency identifier, response validation, timeout and conservative ambiguous-response handling.
- `TRANSACTIONAL-COMMUNICATIONS.md` documents independent event/communication ledger and semantic deduplication keys, uncertainty/manual-review, retry and monitoring safeguards, background worker and production gate defaults.
- The 13 October offline template previews use synthetic data only and do not contact Brevo. The checkout/payment staged successes do not constitute proof of live production mail receipt.
- The existing early-access signup Cloudflare Worker is separate from commerce transactional email; its working signup flow is not evidence that the commerce background worker can send.

## EM-01 remaining evidence to close

| Check | Current conclusion | Safe next evidence |
| --- | --- | --- |
| Sender/from name and Reply-To mailbox | NOT REVALIDATED for live production | Read-only Brevo sender/domain status; verify authorised domain/address and monitored support reply mailbox; never show recipient data |
| SPF/DKIM/DMARC authentication | NOT VERIFIED for the production transactional sender in this audit | Read-only DNS/provider alignment and sender verification, without altering records |
| Credential separation | NOT VERIFIED for the commerce background worker | Read-only **presence and permission**, not value, of Render commerce-scoped Brevo key; never reuse Cloudflare signup Worker secret by assumption |
| Worker service readiness | NOT VERIFIED | Check whether dedicated Render background worker exists, exact deployment/revision, migrations, disabled gates and TLS; do not start a new service |
| Live sending gates | NOT AUTHORISED | Keep `COMMERCE_WORKER_ENABLED=false`, `COMMUNICATIONS_ENABLED=false`, `COMMUNICATIONS_LIVE_SEND_ENABLED=false` until separately scoped EM-01/OPS-01/GO-01 approval |
| Receipt/bounce/blocked recipient | OUTSTANDING | Later separately approved restricted test with approved recipient, no customer order, genuine provider evidence and safe containment |
| Monitoring and privacy | OUTSTANDING production sign-off | Named owner/deputy, alert routing and manual-review procedure; confirm provider logs retention and processor controls |
| Commercial content | DEPENDENT | Final K-803 details, approved claims/policies, £74.99 price and delivery, shipment/carrier tracking URLs sourced from genuine fulfilment |

## Safe staged completion path

1. **Now:** review Brevo sender/domain verification and the existence of a dedicated commerce worker/credential in the production dashboard **read-only**. Record yes/no and reviewer/date in the launch register; do not disclose secrets.
2. **Now:** verify approved email template preview and final consumer-facing copy from existing fixtures; no actual message.
3. **Later, after individual owner approval:** controlled production Brevo acceptance/inbox, blocked/bounce, uncertain-send and monitoring validation; named operator, restricted test recipient, rollback/containment and cost boundary.
4. **Only after EM-01, OPS-01 and product/commercial GO-01 approvals:** independently approve any live-send or worker activation. Never infer authorisation from green CI.

**Conclusion:** Email code and template development are materially complete, but live sender/domain, worker, credentials and real delivery evidence remain unresolved. **EM-01: DRAFT APPROVED, not production approved.** No production API, messages or configuration were accessed or changed in this PR.

References: [Transactional communications](TRANSACTIONAL-COMMUNICATIONS.md), [Commerce launch readiness](COMMERCE-LAUNCH-READINESS.md), [Production fulfilment rehearsal plan](PRODUCTION-FULFILMENT-REHEARSAL-PLAN.md).
