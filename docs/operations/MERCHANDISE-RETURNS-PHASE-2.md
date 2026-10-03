# Merchandise returns Phase 2 — controlled decisions

**Status:** Implementation complete; staging decision verification passed on
3 October 2026. Production use is not approved. Phase 1 staging evidence remains in
[MERCHANDISE-RETURNS-PHASE-1-STAGING.md](MERCHANDISE-RETURNS-PHASE-1-STAGING.md).

The earlier roadmap grouped UI and return-driven refunds into Phase 2. This
increment deliberately implements the private Operations decision UI only:
`requested -> approved` or `requested -> rejected`. Existing cancellation and
later backend lifecycle actions remain unchanged. No migration is required;
already-applied migration 0015 must never be edited.

## Operator workflow

Load an order to read its returns. Select a reference to inspect category,
status, version, currency and requested/approved/received item quantities.
Requested cases expose approval and rejection controls. Server-side grants
remain authoritative: reading requires `orders:read`; approval/rejection require
`returns:approve`. The UI does not infer authority from being visible.

Approval requires an explicit integer amount in minor units of the displayed
order currency (GBP 50 minor units = £0.50; zero is a deliberate decision),
quantities within the request with at least one approved unit, and a controlled
receipt requirement. Amounts are not calculated from item prices or policy.
Receipt is required by default; selecting not-required/waiver records the
existing controlled waiver code. Rejection uses `not_approved` or
`duplicate_request`. Currency is inherited from the order, never submitted.

Approval does not issue a refund, contact Mollie, record receipt, close the case,
change fulfilment or restock inventory. Approval cannot later be overwritten.
Decision requests include the displayed version and an idempotency key. Controls
lock during submission. Uncertain responses retain the original command and
lock edits/alternative decisions so a repeat uses the same body/key. Reload
before reviewing a conflict; an uncertain command is not silently replaced.
Command memory lasts for the page session: after a page reload, inspect the
authoritative return before acting. Server-side state/version fencing remains
the final protection. Existing refund controls remain a separate money-movement
workflow; they do not infer a refund amount or permission from return approval.

## Staging verification (manual, synthetic only)

Do not send requests as part of implementation. After an independently approved
deployment, use the authenticated private Operations page. Add only
`returns:approve` to the intended operator's existing private
`OPERATIONS_ACCESS_GRANTS` entry if absent, preserving other grants. The API
rehearsal also needs existing `orders:read` and `returns:manage`. Restart
Operations to load a changed grant. No new secret, environment variable,
Customer enablement, Cloudflare/CORS change or migration is required.

Paste the entire [browser-console script](returns-phase-2-staging-console.js)
once. It is guarded to the staging API and the exact previously verified
synthetic order/item, fixture name, paid/captured state, absent refunds and
fulfilments, and no active return allocations. Invalid requests probe permissions
without repository writes. It asks for explicit synthetic-fixture confirmation,
records its keys in session storage, then rejects one request before approving
a second request with **zero** monetary obligation. Each decision is replayed
and followed by a stale-version attempt. It checks return projections, timeline
counts and unchanged order/payment/refund/fulfilment projections. It never calls
the provider, receipt, close or refund endpoints. No JWT/cookie/email is copied.

Retain the rejected and approved synthetic records as evidence. The approved
case retains its quantity allocation; do not cancel, close, delete or directly
edit it to clear the fixture. If stopped after a write, review the retained
command evidence and authoritative projection rather than rerunning with new
keys. One fixture run is enough; use separately approved synthetic data for
future verification. Inventory comparison is not possible through this API;
automated repository evidence covers its unchanged state.

The console rehearsal tests the protected API, not UI controls. Separately use
the UI's return selector to inspect the retained requested/approved quantities,
zero monetary decision, version 2 and hidden decision forms on terminal/approved
cases. A requested-case UI submission can be exercised on a separately approved
synthetic fixture; never convert the retained approval to a financial refund.

## Implementation verification — 2 October 2026

Local automated verification passed: commerce core 16/16, commerce API 171/171,
existing capture/refund UI 16/16, returns UI/console rehearsal 13/13 and disposable
PostgreSQL returns rehearsal 21/21. The latter checks real allocation contention,
decision replay/audit uniqueness, quantity/version fences and unchanged payment,
refund, fulfilment and inventory records. Fresh local migrations and database
verification passed with 15 migrations and 25 required tables.

Type checks, static/runtime builds, accessibility/link/security/dependency audits
and the existing performance audit passed. The production build retains inline
browser scripts and generates zero JavaScript bundles. Synthetic local browser
checks covered 320, 390, 768, 1280 and 1920 pixel widths and a zero-amount approval.
This is local implementation evidence. Staging decision verification was completed
on 3 October 2026 as recorded below.

## Staging decision verification — 3 October 2026

The guarded rehearsal was run against the authenticated Operations Staging API
using synthetic order `CYPH-T-4FFB876A8A9A` only. The first run created return
`RET-1853B16A073049BD`, then rejected it at version 2 with decision reason
`not_approved`. The rehearsal subsequently stopped at its replay-response
comparison even though the replay returned HTTP 200.

Inspection confirmed this was a rehearsal false negative rather than a return
idempotency failure. The original response is assembled as a JavaScript return
projection, while an idempotent replay is read from PostgreSQL `jsonb`, which
does not preserve object-key ordering. The rehearsal had compared raw
`JSON.stringify()` output and therefore treated semantically identical objects
with different key order as different. The comparison was changed to recursively
canonicalise object keys before comparing JSON, and an automated regression test
was added for reordered replay JSON.

The retained rejected return was then verified read-only against authoritative
staging state: status `rejected`, version 2, decision reason `not_approved`, zero
refunds and zero fulfilments. The order timeline contained one corresponding
`return.requested` event and one `return.rejected` event from the Phase 2 attempt,
confirming the idempotent replay did not duplicate the rejection audit event.

The original two-case rehearsal was deliberately not rerun. A guarded continuation
performed only the outstanding approval case and retained return
`RET-789D073701344D5A`. It finished `approved` at version 2 with
`approvedRefundMinor: 0` and `receiptRequired: true`. Exact-command idempotent
replay passed using semantic JSON comparison, and a new-key stale-version attempt
was rejected with the expected conflict. The continuation also verified exactly
one new request and approval audit event and unchanged payment, refund and
fulfilment projections.

**Result: PASS for Phase 2 controlled decision staging verification.** Both
synthetic records are retained as evidence and must not be deleted, closed or
repurposed. No refund was issued, no goods were received or inspected, no return
was closed, and no fulfilment action was initiated. Return-driven refunds and the
remaining lifecycle UI continue to be deferred work below.

## Deferred work

Return-driven refund reservation/association and provider reconciliation require
a separate increment (Phase 3), with `returns:approve` **and** `refunds:create`,
association before provider contact and ambiguous-outcome protection. Receipt,
inspection and closure UI, creation/cancellation UI, inventory/fulfilment
orchestration, exports, customer routes, communications and policy/legal approval
are not added here. Existing later backend capabilities are preserved.
