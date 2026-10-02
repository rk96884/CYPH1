// Paste the complete script into the authenticated private Operations UI console.
// Never run against production. This script creates synthetic return evidence.
(async () => {
  const api = document.querySelector('.ops')?.getAttribute('data-api');
  if (api !== 'https://operations-staging.cyph1.co.uk') throw new Error('Unexpected API origin; stopped.');
  const orderId = '4ffb876a-8a9a-4003-a2a8-f98b3963787c';
  const orderNumber = 'CYPH-T-4FFB876A8A9A';
  const itemId = 'dcffdd62-7385-4128-b249-4b52a8879fa7';
  const path = `/operations/orders/${orderId}`;
  const marker = `cyph1-returns-phase2:${orderId}`;
  const request = async (suffix, body, key) => {
    const response = await fetch(`${api}${path}${suffix}`, {
      credentials: 'include',
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) })
    });
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Unexpected response; check Access session.');
    return { status: response.status, data: await response.json() };
  };
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const read = async suffix => { const result = await request(suffix); check(result.status === 200, `Read failed (${result.status}); stopped.`); return result.data; };
  const baseline = await read('');
  const before = (await read('/returns')).returns;
  check(baseline.order.id === orderId && baseline.order.orderNumber === orderNumber, 'Synthetic order identity mismatch.');
  check(baseline.items?.length === 1 && baseline.items[0].id === itemId && baseline.items[0].name_snapshot === 'INTEGRATION TEST FIXTURE — NOT FOR SALE', 'Synthetic item mismatch.');
  check(baseline.items[0].quantity >= 1 && baseline.order.currency === 'GBP' && baseline.order.status === 'paid' && baseline.order.fulfilmentStatus === 'unfulfilled', 'Order is not in the expected settled synthetic state.');
  check(baseline.payments.length > 0 && baseline.payments.every(payment => payment.status === 'captured') && baseline.refunds.length === 0 && baseline.fulfilments.length === 0, 'Financial/fulfilment activity present; stopped.');
  check(before.every(record => ['cancelled', 'rejected'].includes(record.status)), 'Existing active return; review it rather than creating another.');
  check(!sessionStorage.getItem(marker), 'This browser has already started this rehearsal. Review retained evidence; do not create new commands blindly.');
  // Invalid payloads prove grants before any repository call or write.
  for (const suffix of ['/returns', '/returns/00000000-0000-0000-0000-000000000000/approve', '/returns/00000000-0000-0000-0000-000000000000/reject']) {
    const probe = await request(suffix, {}, crypto.randomUUID());
    check(probe.status === 400 && probe.data.code === 'invalid_request', `Permission/validation probe failed (${probe.status}); no lifecycle writes attempted.`);
  }
  if (!confirm(`Verify ${orderNumber} is the approved synthetic fixture. This will retain one rejected return and one approved return with a zero monetary decision; no refund, receipt or closure. Continue?`)) return;
  const evidence = { orderId, orderNumber, startedAt: new Date().toISOString(), cases: [] };
  sessionStorage.setItem(marker, JSON.stringify(evidence));
  const stableState = details => JSON.stringify({ order: details.order, payments: details.payments, refunds: details.refunds, fulfilments: details.fulfilments, captureCommand: details.captureCommand });
  const originalState = stableState(baseline);
  const save = () => sessionStorage.setItem(marker, JSON.stringify(evidence));
  try {
    for (const action of ['reject', 'approve']) {
      const createKey = crypto.randomUUID();
      const entry = { action, createKey, decisionKey: crypto.randomUUID() };
      evidence.cases.push(entry); save();
      const created = await request('/returns', { category: 'customer_choice', items: [{ orderItemId: itemId, quantity: 1 }] }, createKey);
      check(created.status === 201 && created.data.status === 'requested' && created.data.version === 1, `Create failed (${created.status}); stopped.`);
      entry.returnId = created.data.id; entry.reference = created.data.reference; save();
      check(/^RET-[A-F0-9]{16}$/.test(entry.reference), 'Invalid return reference.');
      const body = action === 'reject' ? { expectedVersion: 1, reason: 'not_approved' } : {
        expectedVersion: 1, approvedRefundMinor: 0, receiptRequired: true, items: [{ orderItemId: itemId, quantity: 1 }]
      };
      entry.body = body; save();
      const route = `/returns/${entry.returnId}/${action}`;
      const decided = await request(route, body, entry.decisionKey);
      check(decided.status === 200 && decided.data.status === (action === 'approve' ? 'approved' : 'rejected') && decided.data.version === 2, `Decision failed (${decided.status}); stopped.`);
      const replay = await request(route, body, entry.decisionKey);
      check(replay.status === 200 && JSON.stringify(replay.data) === JSON.stringify(decided.data), 'Decision replay differed.');
      const stale = await request(route, body, crypto.randomUUID());
      check(stale.status === 409 && stale.data.code === 'conflict' && stale.data.message === 'The return changed. Reload it before acting.', 'Stale version was not rejected.');
      const details = await read('');
      const records = (await read('/returns')).returns;
      const expectedAction = action === 'approve' ? 'return.approved' : 'return.rejected';
      const matches = details.timeline.filter(event => event.action === expectedAction && event.summary.orderId === orderId);
      const baselineMatches = baseline.timeline.filter(event => event.action === expectedAction && event.summary.orderId === orderId);
      check(matches.length === baselineMatches.length + 1, 'Decision audit count changed unexpectedly.');
      check(records.filter(record => record.id === entry.returnId).length === 1 && records.find(record => record.id === entry.returnId).version === 2, 'Final return projection mismatch.');
      check(stableState(details) === originalState, 'Payment/refund/order/fulfilment state changed; investigate and stop.');
      check(records.length === before.length + evidence.cases.length, 'Unexpected return count.');
      const requests = details.timeline.filter(event => event.action === 'return.requested').length;
      check(requests === baseline.timeline.filter(event => event.action === 'return.requested').length + evidence.cases.length, 'Unexpected request audit count.');
      if (action === 'approve') check(decided.data.approvedRefundMinor === 0 && decided.data.currency === 'GBP' && decided.data.receivedAt === null && decided.data.closedAt === null, 'Unexpected financial/receipt/closure decision.');
      entry.passed = true; save();
    }
    evidence.result = 'PASS'; save();
    console.table(evidence.cases.map(({ action, returnId, reference, passed }) => ({ action, returnId, reference, passed })));
    console.log('PHASE 2 DECISION API REHEARSAL: PASS. Financial and fulfilment projections unchanged. Inventory is not exposed by this API; UI interaction must be checked separately. Synthetic evidence retained.');
  } catch (problem) {
    evidence.result = 'STOPPED'; save();
    console.error(problem instanceof Error ? problem.message : 'Rehearsal stopped.');
    console.log('Retained synthetic command evidence in sessionStorage. Review existing returns before further action; do not rerun with new keys.');
  }
})();
