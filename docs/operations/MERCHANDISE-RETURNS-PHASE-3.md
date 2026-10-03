# Merchandise returns Phase 3 — explicit approved refunds

**Status:** Implemented for staging verification; production commerce remains
disabled. No live communications provider is enabled. Phase 1/2 evidence is
unchanged. Deployment and the manual rehearsal below are not performed by this
implementation.

## Scope and invariants

`POST /operations/orders/:orderId/returns/:returnId/refund` requires **both**
`returns:approve` and `refunds:create`, the existing protected Access identity,
an `Idempotency-Key` (1–128 ASCII letters/digits/`.`/`_`/`:`/`-`) and JSON
`{"expectedVersion":2}` using the actual displayed version. Extra fields,
including amount, currency and reason, are rejected. Reading requires
`orders:read`. Grant changes require an Operations restart; there are no new
permissions, environment variables, secrets, dependencies or migrations.

The existing refund engine reserves the command transactionally. It locks the
return, checks same-order identity, approved state/version, positive safe-integer
approved amount, compatible return/order/payment currency and a paid/partially
refunded order with captured/partially-refunded provider payment. It rejects any
existing linked refund, including failed or resolution-required records. It
derives the entire amount from the immutable approval and uses `returned_goods`.
`refunds.return_id`, refund reservation, command and audit are committed together
**before provider lookup/contact**. No later attachment step exists.

Return-row locking prevents distinct commands from duplicating a return refund.
Idempotency-key locking serializes identical commands; fingerprint conflicts
are rejected. The existing payment lock protects return and ordinary refunds
together. Reserved balance is read in a fresh statement after that lock is
obtained, including `resolution_required`, so a waited-for concurrent reservation
cannot be omitted. Ordinary refunds retain their existing route, reason/amount
input, provider handling and NULL return association.

Return refunds take the refunds-table reservation lock before the return lock
and refuse a busy payment lock with a controlled 409. This avoids waiting cycles
with existing closure and payment-completion lock ordering. A busy conflict
commits no reservation; reload and review before another explicit attempt.

The private UI exposes **Issue approved refund** only for positive approved
returns without linked refunds. No amount entry is offered. It sends the version
and retains the original key on uncertain responses. Safe linked projections
show only refund ID, state, amount and currency. All linked outcomes suppress a
new submission. Reload after conflicts; after an ambiguous result inspect the
existing refund and Mollie test dashboard, then use the existing webhook/
reconciliation/manual-resolution process. Do not substitute a new key to bypass
an uncertain outcome or failed linked record. This phase adds no recovery engine.

Only existing confirmed `refund.completed` events enter the transactional
communications consumer. Reservation, pending, failed and resolution-required
do not enqueue a refund confirmation. Existing event-key uniqueness and semantic
delivery key `refund:<refundId>` protect replay/duplicate source events. Do not
enable live sending merely to test this feature.

Approval is still separate from refund execution. This phase does not receive,
inspect, close or automatically close returns; change inventory/fulfilment;
create self-service/customer routes; or enable production commerce.

## Guarded manual staging rehearsal

After independently approving/deploying staging, use a **dedicated confirmed
synthetic test order**, with the integration fixture name, a captured Mollie
test-mode payment, no previous refund/fulfilment, and an approved positive return
within the available payment balance. Do not change the retained Phase 2
zero-obligation approval. Confirm Mollie test mode and leave live communications
disabled before proceeding. The operator needs the two action grants and
`orders:read`; existing protected browser credentials are used without copying
JWTs, cookies or email.

In the authenticated private Operations page, fill only the two synthetic IDs
below and paste once. The script retains the exact command before submission,
stops on uncertain outcomes, checks replay and linked state, and never creates,
approves, receives, closes or retries with a fresh key. A refund can genuinely
move test-mode money; the confirmation is deliberate. Pending outcomes require
later read-only refresh/provider verification, not another submission.

```js
(async () => {
  const orderId = 'REPLACE_WITH_CONFIRMED_SYNTHETIC_ORDER_UUID';
  const returnId = 'REPLACE_WITH_APPROVED_SYNTHETIC_RETURN_UUID';
  const api = document.querySelector('.ops')?.getAttribute('data-api');
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(api === 'https://operations-staging.cyph1.co.uk', 'Unexpected API origin.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  check(uuid.test(orderId) && uuid.test(returnId), 'Fill the two confirmed synthetic UUIDs.');
  const path = `/operations/orders/${orderId}`;
  const call = async (suffix, body, key) => {
    const response = await fetch(api + path + suffix, { credentials: 'include',
      ...(body ? { method: 'POST', headers: {'Content-Type':'application/json', 'Idempotency-Key':key}, body:JSON.stringify(body) } : {}) });
    check(response.headers.get('content-type')?.includes('application/json'), 'Check Access session; stopped.');
    return {status:response.status, data:await response.json()};
  };
  const read = async suffix => { const r = await call(suffix); check(r.status === 200, 'Read failed.'); return r.data; };
  const baseline = await read('');
  const records = (await read('/returns')).returns;
  const record = records.find(r => r.id === returnId);
  check(baseline.order.id === orderId && /^CYPH-T-/.test(baseline.order.orderNumber), 'Synthetic identity mismatch.');
  check(baseline.items.length > 0 && baseline.items.every(i => i.name_snapshot === 'INTEGRATION TEST FIXTURE — NOT FOR SALE'), 'Fixture mismatch.');
  check(baseline.order.status === 'paid' && baseline.order.currency === 'GBP' && baseline.order.fulfilmentStatus === 'unfulfilled' && baseline.refunds.length === 0 && baseline.fulfilments.length === 0, 'Unsafe baseline.');
  check(baseline.payments.length > 0 && baseline.payments.every(p => p.status === 'captured' && p.provider === 'mollie-test'), 'Not captured test-provider payment.');
  check(record?.orderId === orderId && record.status === 'approved' && record.currency === 'GBP' && Number.isSafeInteger(record.approvedRefundMinor) && record.approvedRefundMinor > 0 && record.refunds.length === 0, 'Return is ineligible.');
  const marker = `cyph1-return-refund:${returnId}`;
  check(!sessionStorage.getItem(marker), 'Prior command exists; review it, do not use a new key.');
  const route = `/returns/${returnId}/refund`;
  const probe = await call(route, {}, crypto.randomUUID());
  check(probe.status === 400 && probe.data.code === 'invalid_request', 'Permission probe failed; stopped before refund.');
  const stale = await call(route, {expectedVersion:record.version - 1}, crypto.randomUUID());
  check(stale.status === 409 && stale.data.code === 'conflict', 'Stale version guard failed.');
  if (!confirm(`Issue exactly GBP ${(record.approvedRefundMinor/100).toFixed(2)} for ${record.reference} on synthetic ${baseline.order.orderNumber} in Mollie TEST mode?`)) return;
  const command = {key:crypto.randomUUID(), body:{expectedVersion:record.version}, orderId, returnId};
  sessionStorage.setItem(marker, JSON.stringify(command));
  const submitted = await call(route, command.body, command.key);
  check(submitted.status === 201, 'Outcome unconfirmed/failed. Inspect linked refund and Mollie; do not resubmit with a fresh key.');
  const replay = await call(route, command.body, command.key);
  check(replay.status === 201 && replay.data.providerRefundId === submitted.data.providerRefundId && replay.data.status === submitted.data.status, 'Replay mismatch.');
  const after = await read('');
  const final = (await read('/returns')).returns.find(r => r.id === returnId);
  check(final.refunds.length === 1 && final.refunds[0].amountMinor === record.approvedRefundMinor && final.refunds[0].currency === record.currency, 'Linked projection mismatch.');
  check(final.status === 'approved' && final.version === record.version && final.receivedAt === record.receivedAt && final.closedAt === record.closedAt, 'Return lifecycle changed.');
  check(after.order.fulfilmentStatus === baseline.order.fulfilmentStatus && JSON.stringify(after.fulfilments) === JSON.stringify(baseline.fulfilments), 'Fulfilment changed.');
  check(after.timeline.filter(e => e.action === 'refund.reserved' && e.summary.returnId === returnId).length === 1, 'Reservation audit mismatch.');
  console.log('Synthetic return refund replay verified; linked state:', final.refunds[0].status);
})();
```

Retain the approved return, linked refund, command/audit and local rehearsal
evidence. Do not delete, close or directly edit them for cleanup. Verify final
payment/refund state in Mollie test mode and via existing read routes; a completed
refund legitimately changes payment/order refunded state. Outbox/customer-message
deduplication and unchanged inventory are covered by disposable PostgreSQL
verification because those records are not exposed by this browser read API.

## Verification evidence

Local verification on **3 October 2026** passed:

- Commerce core: **16/16**; commerce API: **175/175**.
- Existing capture/refund UI: **16/16**; returns UI: **17/17**; combined
  **33/33**, also tested against the actual built inline scripts.
- Disposable PostgreSQL returns rehearsal: **30/30**. Covers rollback of linked
  reservation/command, committed linkage visible before provider lookup,
  wrong state/order/version/zero/currency, same/different-key concurrency,
  shared ordinary-refund balance contention, busy completion/closure locks,
  replay/audit/outbox uniqueness,
  pending/failed/uncertain blocking, unchanged return/inventory/fulfilment and
  actual refund-confirmation consumer semantic deduplication. Local-only fake
  providers were used; no Mollie/email requests were sent.
- Fresh local schema: **15 migrations**, **25 required tables**; constraint
  verification passed. Applied migrations and checksums are unchanged.
- Astro/commerce TypeScript checks and static/runtime builds passed.
- Accessibility, private-commerce accessibility, links, security and dependency
  audits passed; **zero vulnerabilities**. Restore verifier **4/4** and
  dependency-audit policy tests **3/3** passed.
- Existing performance audit: **0 generated JavaScript bundles**,
  **194.1 KiB gzip** against the unchanged **200 KiB** budget.
- Local mocked browser verified the eligible action, linked pending state and
  suppression after submission; no horizontal overflow at **320/390/768/1280/1920**
  pixels. Diff whitespace checks passed.

The staging rehearsal has **not** been executed; these results do not approve
production commerce or live communications.
