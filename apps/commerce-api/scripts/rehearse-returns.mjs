import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

const url = new URL(process.env.RETURNS_TEST_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || url.href.includes("?") || !["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_returns_test")) throw new Error("RETURNS_TEST_DATABASE_URL must identify a disposable local *_returns_test database without query parameters.");
const { PostgresReturnRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/returns/postgres.js");
const { ReturnService } = await import("../../../build/commerce-api/apps/commerce-api/src/returns/service.js");
const { PostgresOperationsRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/operations/postgres.js");
const { OperationsService } = await import("../../../build/commerce-api/apps/commerce-api/src/operations/service.js");
const { PostgresCommunicationRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/communications/postgres.js");
const { TransactionalCommunicationConsumer } = await import("../../../build/commerce-api/apps/commerce-api/src/communications/service.js");
const { PaymentProviderError } = await import("../../../build/commerce-api/packages/commerce-core/src/index.js");
const pool = new pg.Pool({ connectionString: url.href, max: 12, application_name: "returns-rehearsal" });
const service = new ReturnService(new PostgresReturnRepository(pool));
const operator = "returns-rehearsal";
let checks = 0;
const pass = (name) => { checks++; console.log(`PASS ${name}`); };
const request = (order, items, key = randomUUID()) => service.request(order.id, { category: "fault_reported", items }, operator, key);
const act = (record, action, body = {}, key = randomUUID()) => service.act(record.orderId, record.id, action, { expectedVersion: record.version, ...body }, operator, key);
const approve = (record, amount = 0, waived = false, quantities = record.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.requestedQuantity }))) => act(record, "approve", { approvedRefundMinor: amount, receiptRequired: !waived, ...(waived ? { receiptWaiverReason: "operator_waiver" } : {}), items: quantities });
const receipt = (record) => act(record, "receive", { items: record.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.approvedQuantity })) });
const createOrder = async (quantity = 2) => {
  const id = randomUUID();
  await pool.query(`INSERT INTO orders(id,order_number,status,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES($1,$2,'paid','GBP',$3,$3,'{}')`, [id, `RETURNS-TEST-${id}`, quantity * 100]);
  const item = await pool.query(`INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,'RETURNS-TEST','Synthetic item',100,$3,$4) RETURNING id`, [id, productId, quantity, quantity * 100]);
  const payment = await pool.query(`INSERT INTO payments(order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key) VALUES($1,'manual-test',$2,'captured',$3,'GBP',$4) RETURNING id`, [id, `tr_${randomUUID()}`, quantity * 100, randomUUID()]);
  return { id, itemId: item.rows[0].id, paymentId: payment.rows[0].id, items: [{ orderItemId: item.rows[0].id, quantity }] };
};
let productId;
try {
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM schema_migrations WHERE version='0015_merchandise_returns.sql'")).rows[0].count, 1);
  productId = (await pool.query(`INSERT INTO products(sku,slug,name,description,status,price_minor,currency,tax_code,content_version) VALUES($1,$2,'Synthetic returns item','Not for sale','private',100,'GBP','TEST','returns-rehearsal') RETURNING id`, [`RET-${randomUUID()}`, `ret-${randomUUID()}`])).rows[0].id;
  await pool.query("INSERT INTO inventory_levels(product_id,location_key,available_quantity,reserved_quantity,safety_stock,source,source_updated_at) VALUES($1,'returns-rehearsal',5,1,0,'synthetic-test',now())", [productId]);
  const order = await createOrder();
  let full = await request(order, order.items);
  assert.match(full.reference, /^RET-[A-F0-9]{16}$/); assert.equal(full.approvedRefundMinor, null);
  await assert.rejects(() => request(order, order.items), /available purchased/);
  pass("full allocation is durable and overlapping requests are blocked");
  const key = randomUUID();
  const withdrawn = await act(full, "cancel", { reason: "request_withdrawn" }, key);
  assert.deepEqual(await act(full, "cancel", { reason: "request_withdrawn" }, key), withdrawn);
  await assert.rejects(() => act(full, "cancel", { reason: "duplicate_request" }, key), /different request/);
  const snapshot = await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE entity_id=$1 AND action='return.cancelled'", [full.id]); assert.equal(snapshot.rows[0].count, 1);
  pass("duplicate commands replay once and conflicting key reuse is rejected");
  full = await request(order, order.items); const rejected = await act(full, "reject", { reason: "not_approved" });
  await assert.rejects(() => act(rejected, "approve", { approvedRefundMinor: 0, receiptRequired: true, items: order.items }), /current state/);
  full = await request(order, order.items);
  pass("cancelled and rejected requests release allocation and remain terminal");
  const decisionOrder = await createOrder(); const decisionRequest = await request(decisionOrder, decisionOrder.items);
  const baselineState = async () => (await pool.query(`SELECT
    (SELECT row_to_json(o) FROM orders o WHERE id=$1) AS order_state,
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p WHERE order_id=$1) AS payments,
    (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1) AS refunds,
    (SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM fulfilments f WHERE order_id=$1) AS fulfilments,
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM inventory_levels i WHERE product_id=$2) AS inventory`, [decisionOrder.id, productId])).rows[0];
  const beforeDecision = await baselineState();
  const approvalBody = { approvedRefundMinor: 50, receiptRequired: true, items: [{ orderItemId: decisionOrder.itemId, quantity: 1 }] };
  await assert.rejects(() => act(decisionRequest, "approve", { ...approvalBody, items: [{ orderItemId: decisionOrder.itemId, quantity: 3 }] }), /exceed the request/);
  const approvalKey = randomUUID();
  const approved = await act(decisionRequest, "approve", approvalBody, approvalKey);
  assert.deepEqual(await act(decisionRequest, "approve", approvalBody, approvalKey), approved);
  assert.equal(approved.currency, "GBP"); assert.equal(approved.approvedRefundMinor, 50);
  assert.equal(approved.items[0].requestedQuantity, 2); assert.equal(approved.items[0].approvedQuantity, 1);
  assert.equal(approved.items[0].receivedQuantity, 0); assert.equal(approved.receivedAt, null);
  await assert.rejects(() => act(decisionRequest, "approve", approvalBody), /changed/);
  await assert.rejects(() => act(decisionRequest, "approve", { ...approvalBody, approvedRefundMinor: 100 }, approvalKey), /different request/);
  await assert.rejects(() => act(approved, "reject", { reason: "not_approved" }), /current state/);
  let declined = await request(decisionOrder, [{ orderItemId: decisionOrder.itemId, quantity: 1 }]);
  const declinedOriginal = declined; const rejectionKey = randomUUID();
  declined = await act(declined, "reject", { reason: "not_approved" }, rejectionKey);
  assert.deepEqual(await act(declinedOriginal, "reject", { reason: "not_approved" }, rejectionKey), declined);
  await assert.rejects(() => act(declinedOriginal, "reject", { reason: "not_approved" }), /changed/);
  assert.deepEqual(await baselineState(), beforeDecision);
  const decisionTimeline = (await new PostgresOperationsRepository(pool).getOrder(decisionOrder.id)).timeline;
  assert.equal(decisionTimeline.filter(event => event.action === "return.approved").length, 1);
  assert.equal(decisionTimeline.filter(event => event.action === "return.rejected").length, 1);
  pass("approval/rejection replays preserve decisions, currency, allocation and audit uniqueness without financial, inventory or fulfilment effects");
  const other = await createOrder();
  await assert.rejects(() => request(other, order.items), /belong/);
  for (const quantity of [0, -1, 0.5]) await assert.rejects(() => request(other, [{ orderItemId: other.itemId, quantity }]));
  pass("wrong-order items and invalid quantities are rejected");
  const oldFull = full;
  full = await approve(full);
  await assert.rejects(() => act(oldFull, "approve", { approvedRefundMinor: 100, receiptRequired: true, items: order.items }), /changed/);
  await assert.rejects(() => approve(full, 100), /current state/);
  await assert.rejects(() => act(full, "close"), /current state/);
  const refundCountBefore = (await pool.query("SELECT count(*)::int AS count FROM refunds")).rows[0].count;
  full = await receipt(full); assert.equal(full.status, "received"); assert.equal(full.inspectedAt, null); assert.equal(full.approvedRefundMinor, 0);
  await assert.rejects(() => act(full, "close"), /separate inspection/);
  full = await act(full, "inspect", { outcome: "inconclusive" });
  await assert.rejects(() => act(full, "inspect", { outcome: "no_issue_observed" }), /already recorded/);
  full = await act(full, "close"); assert.equal(full.closureReason, "no_refund_due");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM refunds")).rows[0].count, refundCountBefore);
  assert.equal((await pool.query("SELECT status,fulfilment_status FROM orders WHERE id=$1", [order.id])).rows[0].status, "paid");
  await assert.rejects(() => request(order, order.items), /available purchased/);
  pass("zero decisions, immutable approval/inspection, distinct receipt and closure produce no refunds or fulfilment");
  const partialOrder = await createOrder(3);
  let partial = await request(partialOrder, [{ orderItemId: partialOrder.itemId, quantity: 3 }]);
  partial = await approve(partial, 0, false, [{ orderItemId: partialOrder.itemId, quantity: 1 }]);
  const remaining = await request(partialOrder, [{ orderItemId: partialOrder.itemId, quantity: 2 }]);
  assert.equal(remaining.items[0].requestedQuantity, 2);
  partial = await receipt(partial); assert.equal(partial.items[0].receivedQuantity, 1);
  pass("partial approval releases only unapproved units and receipt respects approval");
  const stagedOrder = await createOrder(2); let staged = await request(stagedOrder, stagedOrder.items); staged = await approve(staged);
  staged = await act(staged, "receive", { items: [{ orderItemId: stagedOrder.itemId, quantity: 1 }] });
  await assert.rejects(() => act(staged, "inspect", { outcome: "inconclusive" }), /before final inspection/);
  await assert.rejects(() => act(staged, "receive", { items: [{ orderItemId: stagedOrder.itemId, quantity: 0 }] }));
  staged = await receipt(staged); staged = await act(staged, "inspect", { outcome: "no_issue_observed" });
  await assert.rejects(() => receipt(staged), /after inspection/);
  pass("partial receipts accumulate monotonically and final inspection waits for complete receipt");
  let waived = await request(other, other.items); waived = await approve(waived, 0, true); waived = await act(waived, "close");
  assert.equal(waived.receivedAt, null); assert.equal(waived.receiptWaiverReason, "operator_waiver"); assert.equal(waived.status, "closed");
  pass("explicit receipt waiver permits approved-to-closed with zero obligation");
  const financialOrder = await createOrder(); let financial = await request(financialOrder, financialOrder.items); financial = await approve(financial, 100, true);
  await assert.rejects(() => act(financial, "close"), /not satisfied/);
  // Synthetic linked records simulate future Phase 2 persistence, never a provider call.
  const linked = (await pool.query(`INSERT INTO refunds(payment_id,return_id,amount_minor,currency,reason,status,idempotency_key) VALUES($1,$2,100,'GBP','returned_goods','resolution_required',$3) RETURNING id`, [financialOrder.paymentId, financial.id, randomUUID()])).rows[0].id;
  await assert.rejects(() => act(financial, "close"), /requires resolution/);
  await pool.query("UPDATE refunds SET status='pending' WHERE id=$1", [linked]); await assert.rejects(() => act(financial, "close"), /requires resolution/);
  await pool.query("UPDATE refunds SET status='completed' WHERE id=$1", [linked]); financial = await act(financial, "close"); assert.equal(financial.closureReason, "refund_completed");
  pass("positive obligation cannot close unpaid, pending or ambiguous; confirmed linked settlement permits closure");
  const mismatchOrder = await createOrder(); let mismatch = await request(mismatchOrder, mismatchOrder.items); mismatch = await approve(mismatch, 100, true);
  await pool.query(`INSERT INTO refunds(payment_id,return_id,amount_minor,currency,reason,status,idempotency_key)
    VALUES($1,$2,100,'GBP','returned_goods','completed',$3)`, [other.paymentId, mismatch.id, randomUUID()]);
  await assert.rejects(() => act(mismatch, "close"), (error) => error.code === "conflict" && /relationship requires resolution/.test(error.message));
  assert.equal((await service.list(mismatchOrder.id))[0].status, "approved");
  pass("wrong-order completed refund linkage cannot satisfy a return obligation");
  const busyOrder = await createOrder(); let busy = await request(busyOrder, busyOrder.items); busy = await approve(busy, 0, true);
  const inFlight = (await pool.query(`INSERT INTO refunds(payment_id,amount_minor,currency,reason,status,idempotency_key)
    VALUES($1,100,'GBP','customer_request','created',$2) RETURNING id`, [busyOrder.paymentId, randomUUID()])).rows[0].id;
  await assert.rejects(() => act(busy, "close"), /requires resolution/);
  const writer = await pool.connect();
  try {
    await writer.query("BEGIN");
    await writer.query("UPDATE refunds SET status='resolution_required' WHERE id=$1", [inFlight]);
    // Real uncommitted provider-outcome write holds ROW EXCLUSIVE; closure must
    // refuse immediately rather than wait on the refund while holding the order.
    await assert.rejects(() => act(busy, "close"), (error) => error.code === "conflict" && /another action/.test(error.message));
    assert.equal((await service.list(busyOrder.id))[0].status, "approved");
    await writer.query("COMMIT");
    await assert.rejects(() => act(busy, "close"), /requires resolution/);
  } finally { await writer.query("ROLLBACK"); writer.release(); }
  pass("real in-flight refund write prevents closure before and after uncertain-outcome commit");
  const readOrder = await createOrder(); let readable = await request(readOrder, readOrder.items); readable = await approve(readable);
  const reader = await pool.connect();
  try {
    const consistentPool = { query: async (sql, parameters) => {
      const result = await reader.query(sql, parameters);
      // Mutate after the repository SELECT, before it constructs its response.
      await receipt(readable);
      return result;
    } };
    const before = await new PostgresReturnRepository(consistentPool).list(readOrder.id);
    assert.equal(before[0].items[0].receivedQuantity, 0);
    assert.equal(before[0].status, "approved");
    const after = (await service.list(readOrder.id))[0];
    assert.equal(after.items[0].receivedQuantity, 2); assert.equal(after.status, "received");
    pass("return rows and item quantities are materialized from one statement snapshot");
  } finally { reader.release(); }
  const fencedOrder = await createOrder(); let fenced = await request(fencedOrder, fencedOrder.items); fenced = await approve(fenced, 0, true);
  let acquired; let releaseFence;
  const lockAcquired = new Promise((resolve) => { acquired = resolve; });
  const gate = new Promise((resolve) => { releaseFence = resolve; });
  const gatedRepository = new PostgresReturnRepository({ connect: async () => {
    const client = await pool.connect();
    return { release: () => client.release(), query: async (sql, parameters) => {
      const result = await client.query(sql, parameters);
      if (sql === "LOCK TABLE refunds IN SHARE MODE NOWAIT") { acquired(); await gate; }
      return result;
    } };
  } });
  const closing = new ReturnService(gatedRepository).act(fenced.orderId, fenced.id, "close", { expectedVersion: fenced.version }, operator, randomUUID());
  await lockAcquired;
  const reservation = await pool.connect();
  let inserting;
  try {
    const pid = (await reservation.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    inserting = reservation.query(`INSERT INTO refunds(payment_id,amount_minor,currency,reason,status,idempotency_key)
      VALUES($1,100,'GBP','customer_request','created',$2)`, [fencedOrder.paymentId, randomUUID()]);
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await pool.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0].wait_event_type === "Lock") { waiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(waiting, true);
  } finally { releaseFence(); await closing; if (inserting) await inserting; reservation.release(); }
  assert.equal((await service.list(fencedOrder.id))[0].status, "closed");
  pass("closure fence holds new refund reservation until closure commits (observed PostgreSQL lock wait)");
  const heldOrder = await createOrder(); let held = await request(heldOrder, heldOrder.items); held = await approve(held, 0, true);
  const orderWriter = await pool.connect();
  try {
    await orderWriter.query("BEGIN"); await orderWriter.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [heldOrder.id]);
    await assert.rejects(() => act(held, "close"), (error) => error.code === "conflict");
    // After refusal the SHARE lock must be released, allowing the order holder
    // to write a refund (including multi-event webhook transaction ordering).
    await orderWriter.query("SET LOCAL lock_timeout='1s'");
    await orderWriter.query(`INSERT INTO refunds(payment_id,amount_minor,currency,reason,status,idempotency_key)
      VALUES($1,100,'GBP','customer_request','created',$2)`, [heldOrder.paymentId, randomUUID()]);
  } finally { await orderWriter.query("ROLLBACK"); orderWriter.release(); }
  pass("busy order closure refuses without retaining a fence that blocks its refund writer");
  const concurrentOrder = await createOrder(1);
  const blocker = await pool.connect(); await blocker.query("BEGIN"); await blocker.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [concurrentOrder.id]);
  const contenders = Array.from({ length: 4 }, () => request(concurrentOrder, concurrentOrder.items));
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name='returns-rehearsal' AND wait_event_type='Lock'")).rows[0].count >= 2) { waiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally { await blocker.query("COMMIT"); blocker.release(); }
  const results = await Promise.allSettled(contenders); assert.equal(waiting, true); assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  for (const result of results) if (result.status === "rejected") assert.equal(result.reason.code, "conflict");
  pass("real PostgreSQL lock contention admits one allocation and rejects three competing allocations");
  const one = results.find((result) => result.status === "fulfilled").value;
  const concurrentKey = randomUUID();
  const replayed = await Promise.all(Array.from({ length: 4 }, () => act(one, "cancel", { reason: "request_withdrawn" }, concurrentKey)));
  assert.ok(replayed.every((result) => result.version === 2));
  pass("four concurrent identical mutations produce one revision and one durable command");
  const race = await request(concurrentOrder, concurrentOrder.items);
  const revisions = await Promise.allSettled([act(race, "cancel", { reason: "request_withdrawn" }), act(race, "reject", { reason: "not_approved" })]);
  assert.equal(revisions.filter((result) => result.status === "fulfilled").length, 1);
  pass("concurrent different mutations fence stale versions");
  const details = await new PostgresOperationsRepository(pool).getOrder(order.id);
  assert.equal(details.items[0].id, order.itemId); assert.equal(details.items[0].quantity, 2);
  assert.ok(details.timeline.some((event) => event.action === "return.closed"));
  assert.equal((await service.list(order.id)).length, 3);
  const audit = await pool.query("SELECT action,actor_id,correlation_id,change_summary FROM audit_events WHERE entity_type='return'");
  assert.deepEqual([...new Set(audit.rows.map((event) => event.action))].sort(), ["return.approved", "return.cancelled", "return.closed", "return.inspected", "return.received", "return.rejected", "return.requested"]);
  assert.ok(audit.rows.every((event) => event.actor_id === operator && event.correlation_id));
  const auditKeys = {
    "return.requested": ["orderId", "category", "items", "version"],
    "return.approved": ["orderId", "approvedRefundMinor", "currency", "receiptRequired", "receiptWaiverReason", "items", "version"],
    "return.cancelled": ["orderId", "reason", "version"], "return.rejected": ["orderId", "reason", "version"],
    "return.received": ["orderId", "items", "version"], "return.inspected": ["orderId", "outcome", "version"], "return.closed": ["orderId", "reason", "version"],
  };
  for (const event of audit.rows) {
    assert.deepEqual(Object.keys(event.change_summary).sort(), [...auditKeys[event.action]].sort());
    for (const item of event.change_summary.items ?? []) assert.deepEqual(Object.keys(item).sort(), ["orderItemId", "quantity"]);
  }
  assert.doesNotMatch(JSON.stringify(audit.rows), /email|address|customer narrative|health|provider payload/i);
  pass("read projection, order-item selection and controlled attributed audit integrate with the existing timeline");
  const constraintClient = await pool.connect();
  try {
    await constraintClient.query("BEGIN");
    await assert.rejects(() => constraintClient.query("INSERT INTO return_items(return_id,order_id,order_item_id,requested_quantity) VALUES($1,$2,$3,1)", [full.id, other.id, other.itemId]), (error) => error.code === "23503");
    await constraintClient.query("ROLLBACK");
    pass("composite foreign keys reject cross-order return items independently of service validation");
    await constraintClient.query("BEGIN");
    const schema = `returns_migration_${randomUUID().replaceAll('-', '')}`;
    await constraintClient.query(`CREATE SCHEMA ${schema}`); await constraintClient.query(`SET LOCAL search_path TO ${schema},public`);
    const migrationDir = new URL("../db/migrations/", import.meta.url);
    const migrations = (await readdir(migrationDir)).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
    for (const migration of migrations.filter((name) => !name.startsWith("0015_"))) await constraintClient.query(await readFile(new URL(migration, migrationDir), "utf8"));
    const historicalOrder = (await constraintClient.query("INSERT INTO orders(order_number,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES('HISTORICAL','GBP',100,100,'{}') RETURNING id")).rows[0].id;
    const historicalPayment = (await constraintClient.query("INSERT INTO payments(order_id,provider,status,amount_minor,currency,idempotency_key) VALUES($1,'manual-test','captured',100,'GBP','historical') RETURNING id", [historicalOrder])).rows[0].id;
    await constraintClient.query("INSERT INTO refunds(payment_id,amount_minor,currency,reason,status,idempotency_key) VALUES($1,50,'GBP','customer_request','completed','historical-refund')", [historicalPayment]);
    await constraintClient.query(await readFile(new URL("0015_merchandise_returns.sql", migrationDir), "utf8"));
    assert.deepEqual((await constraintClient.query("SELECT return_id,status,amount_minor FROM refunds")).rows, [{ return_id: null, status: "completed", amount_minor: "50" }]);
    await constraintClient.query("ROLLBACK");
    pass("migration preserves pre-existing refunds as NULL-linked records; isolated schema rehearsal rolls back");
  } finally { await constraintClient.query("ROLLBACK"); constraintClient.release(); }
  const operations = new PostgresOperationsRepository(pool);
  const command = (record, key=randomUUID()) => ({orderId:record.orderId,returnId:record.id,expectedVersion:record.version,operatorId:operator,idempotencyKey:key,fingerprint:createHash('sha256').update(`return-refund:${record.id}:${record.version}:${key}`).digest('hex'),correlationId:randomUUID()});
  const refundOrder=await createOrder();const requestedRefund=await request(refundOrder,refundOrder.items);
  await assert.rejects(()=>operations.reserveRefund(command(requestedRefund)),/not eligible/);
  const eligible=await approve(requestedRefund,50);
  await assert.rejects(()=>operations.reserveRefund({...command(eligible),orderId:other.id}),/not found/);
  await assert.rejects(()=>operations.reserveRefund({...command(eligible),expectedVersion:1}),/not eligible/);
  const zeroOrder=await createOrder();const zero=await approve(await request(zeroOrder,zeroOrder.items),0);
  await assert.rejects(()=>operations.reserveRefund(command(zero)),/not eligible/);
  await pool.query("UPDATE returns SET currency='EUR' WHERE id=$1",[eligible.id]);
  await assert.rejects(()=>operations.reserveRefund(command(eligible)),/not eligible/);
  await pool.query("UPDATE returns SET currency='GBP' WHERE id=$1",[eligible.id]);
  await pool.query("UPDATE payments SET currency='EUR' WHERE id=$1",[refundOrder.paymentId]);
  await assert.rejects(()=>operations.reserveRefund(command(eligible)),/currencies/);
  await pool.query("UPDATE payments SET currency='GBP',status='authorised' WHERE id=$1",[refundOrder.paymentId]);
  await assert.rejects(()=>operations.reserveRefund(command(eligible)),/No captured/);
  await pool.query("UPDATE payments SET status='captured' WHERE id=$1",[refundOrder.paymentId]);
  await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1",[refundOrder.id]);
  await assert.rejects(()=>operations.reserveRefund(command(eligible)),/not eligible/);
  await pool.query("UPDATE orders SET status='paid' WHERE id=$1",[refundOrder.id]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE return_id=$1",[eligible.id])).rows[0].n,0);
  pass("return refunds reject wrong state/order/version/zero/return-order-payment currency and uncaptured payment before reservation");

  // Rollback must undo the association, reservation, command and audit together.
  const rollbackCommand=command(eligible);const rollbackRepository=new PostgresOperationsRepository(pool);
  rollbackRepository.audit=async()=>{throw new Error('synthetic reservation rollback');};
  await assert.rejects(()=>rollbackRepository.reserveRefund(rollbackCommand),/synthetic reservation rollback/);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE return_id=$1",[eligible.id])).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM operator_commands WHERE idempotency_key=$1",[rollbackCommand.idempotencyKey])).rows[0].n,0);
  pass("linked refund reservation and command roll back atomically before provider contact");

  let providerCalls=0;let lookups=0;let mode='completed';
  const financialBaseline=async(id)=>(await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(f)) FROM fulfilments f WHERE order_id=$1) AS fulfilments,
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM inventory_levels i WHERE product_id=$2) AS inventory,
    (SELECT row_to_json(r) FROM returns r WHERE id=$3) AS return_state`,[id,productId,eligible.id])).rows[0];
  const beforeMoney=await financialBaseline(refundOrder.id);
  const provider={key:'manual-test',getPayment:async()=>{
    lookups++;const linked=(await pool.query("SELECT return_id,amount_minor,currency,status FROM refunds WHERE return_id=$1",[eligible.id])).rows;
    if(mode==='completed'){assert.equal(linked.length,1);assert.equal(linked[0].status,'created');assert.equal(linked[0].amount_minor,'50');assert.equal(linked[0].currency,'GBP');}
    return {amount:{value:200,currency:'GBP'},refundableAmount:{value:200,currency:'GBP'}};
  },refund:async(input)=>{providerCalls++;if(mode==='ambiguous')throw new PaymentProviderError('network_error','Synthetic uncertainty',true);return {providerRefundId:`re_${input.idempotencyKey}`,status:mode,amount:input.amount};}};
  const refundService=new OperationsService(operations,{getProvider:()=>provider});
  const refundInput={orderId:eligible.orderId,returnId:eligible.id,expectedVersion:eligible.version,operatorId:operator,idempotencyKey:randomUUID()};
  const result=await refundService.refundReturn(refundInput);assert.equal(result.status,'completed');
  assert.deepEqual(await refundService.refundReturn(refundInput),result);
  assert.equal(providerCalls,1);assert.equal(lookups,1);
  await assert.rejects(()=>refundService.refundReturn({...refundInput,idempotencyKey:randomUUID()}),/already linked/);
  await assert.rejects(()=>refundService.refundReturn({...refundInput,expectedVersion:1}),/different request/);
  assert.deepEqual(await financialBaseline(refundOrder.id),beforeMoney);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE action='refund.reserved' AND change_summary->>'returnId'=$1",[eligible.id])).rows[0].n,1);
  const linkedRefund=(await pool.query("SELECT * FROM refunds WHERE return_id=$1",[eligible.id])).rows[0];
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=$1 AND event_type='refund.completed'",[linkedRefund.id])).rows[0].n,1);
  assert.equal((await new PostgresReturnRepository(pool).list(eligible.orderId))[0].refunds[0].status,'completed');
  pass("provider sees committed return_id association; completed refund replays once, emits one refund.completed and leaves return/inventory/fulfilment unchanged");

  for(const status of ['pending','failed','resolution_required']){
    const testOrder=await createOrder();const testReturn=await approve(await request(testOrder,testOrder.items),50);
    mode=status==='resolution_required'?'ambiguous':status;
    const input={orderId:testReturn.orderId,returnId:testReturn.id,expectedVersion:2,operatorId:operator,idempotencyKey:randomUUID()};
    if(mode==='ambiguous')await assert.rejects(()=>refundService.refundReturn(input),/provider/);else await refundService.refundReturn(input);
    const linked=(await pool.query("SELECT id,status FROM refunds WHERE return_id=$1",[testReturn.id])).rows[0];assert.equal(linked.status,status);
    const calls=providerCalls;await assert.rejects(()=>refundService.refundReturn({...input,idempotencyKey:randomUUID()}),/already linked/);assert.equal(providerCalls,calls);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=$1 AND event_type='refund.completed'",[linked.id])).rows[0].n,0);
  }
  pass("pending/failed/ambiguous linked refunds block new submissions and emit no completion/customer message event");

  const raceOrder=await createOrder();const raceReturn=await approve(await request(raceOrder,raceOrder.items),50);
  const refundRace=await Promise.allSettled([operations.reserveRefund(command(raceReturn)),operations.reserveRefund(command(raceReturn))]);
  assert.equal(refundRace.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE return_id=$1",[raceReturn.id])).rows[0].n,1);
  pass("concurrent distinct return refund commands reserve exactly once");
  const sameOrder=await createOrder();const sameReturn=await approve(await request(sameOrder,sameOrder.items),50);const sameCommand=command(sameReturn);
  const sameRace=await Promise.allSettled([operations.reserveRefund(sameCommand),operations.reserveRefund(sameCommand)]);assert.equal(sameRace.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE return_id=$1",[sameReturn.id])).rows[0].n,1);
  pass("same-key concurrent reservation cannot duplicate provider submission");
  const balanceOrder=await createOrder(1);const balanceReturn=await approve(await request(balanceOrder,balanceOrder.items),70);
  const ordinary={orderId:balanceOrder.id,amountMinor:70,reason:'customer_request',operatorId:operator,idempotencyKey:randomUUID(),fingerprint:createHash('sha256').update(randomUUID()).digest('hex'),correlationId:randomUUID()};
  const balanceRace=await Promise.allSettled([operations.reserveRefund(command(balanceReturn)),operations.reserveRefund(ordinary)]);
  assert.equal(balanceRace.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(Number((await pool.query("SELECT sum(amount_minor) AS n FROM refunds WHERE payment_id=$1",[balanceOrder.paymentId])).rows[0].n),70);
  const ordinaryOrder=await createOrder();const ordinaryReservation=await operations.reserveRefund({...ordinary,orderId:ordinaryOrder.id,idempotencyKey:randomUUID(),fingerprint:createHash('sha256').update(randomUUID()).digest('hex')});
  assert.equal((await pool.query("SELECT return_id FROM refunds WHERE id=$1",[ordinaryReservation.refundId])).rows[0].return_id,null);
  pass("return and ordinary refunds contend for the same payment balance; ordinary refunds retain NULL return linkage");

  const busyRefundOrder=await createOrder();const busyReturn=await approve(await request(busyRefundOrder,busyRefundOrder.items),50);
  const busyClient=await pool.connect();
  try {
    await busyClient.query("BEGIN");await busyClient.query("SELECT id FROM payments WHERE id=$1 FOR UPDATE",[busyRefundOrder.paymentId]);
    await assert.rejects(()=>operations.reserveRefund(command(busyReturn)),/busy/);
    await busyClient.query("ROLLBACK");await busyClient.query("BEGIN");await busyClient.query("LOCK TABLE refunds IN SHARE MODE");
    await assert.rejects(()=>operations.reserveRefund(command(busyReturn)),/busy/);
    await busyClient.query("ROLLBACK");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM refunds WHERE return_id=$1",[busyReturn.id])).rows[0].n,0);
  } finally {await busyClient.query("ROLLBACK");busyClient.release();}
  pass("busy completion/closure locks reject return refunds before reservation, avoiding lifecycle lock inversion");

  const customer=(await pool.query("INSERT INTO customers(email_normalised,email_display) VALUES($1,$1) RETURNING id",[`returns-${randomUUID()}@example.test`])).rows[0].id;
  await pool.query("UPDATE orders SET customer_id=$2 WHERE id=$1",[refundOrder.id,customer]);
  await pool.query(`INSERT INTO outbox_events(event_key,event_type,aggregate_type,aggregate_id,payload)
    SELECT $2,event_type,aggregate_type,aggregate_id,payload FROM outbox_events WHERE aggregate_id=$1 AND event_type='refund.completed' LIMIT 1`,[linkedRefund.id,`duplicate-source:${randomUUID()}`]);
  let messages=0;const communications=new TransactionalCommunicationConsumer(true,new PostgresCommunicationRepository(pool),{key:'local-only',send:async()=>{messages++;return {providerReference:'synthetic-message'};}});
  assert.equal((await communications.consumeOne()).outcome,'sent');assert.equal((await communications.consumeOne()).outcome,'empty');assert.equal(messages,1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM communication_deliveries WHERE deduplication_key=$1",[`refund:${linkedRefund.id}`])).rows[0].n,1);
  pass("existing refund-confirmation consumer semantically deduplicates repeated completion source events; no live provider used");
  console.log(`Returns PostgreSQL rehearsal passed: ${checks} checks. Synthetic records remain only in the disposable local database.`);
} finally { await pool.end(); }
