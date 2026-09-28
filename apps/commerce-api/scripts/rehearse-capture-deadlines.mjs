import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { CaptureDeadlineMonitor } from "../../../build/commerce-api/apps/commerce-api/src/payments/capture-monitor.js";
import { PostgresCaptureMonitorRepository } from "../../../build/commerce-api/apps/commerce-api/src/payments/capture-monitor-postgres.js";
import { loadCaptureDeadlineConfig } from "../../../build/commerce-api/apps/commerce-api/src/payments/capture-deadline.js";
import { PostgresFulfilmentRepository } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/postgres.js";
import { PostgresCheckoutRepository } from "../../../build/commerce-api/apps/commerce-api/src/checkout/postgres.js";
import { PaymentWebhookProcessor } from "../../../build/commerce-api/apps/commerce-api/src/webhooks/processor.js";
import { PostgresTransactionRunner } from "../../../build/commerce-api/apps/commerce-api/src/webhooks/postgres.js";

const url = new URL(process.env.CAPTURE_TEST_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_capture_test")) {
  throw new Error("CAPTURE_TEST_DATABASE_URL must identify a fresh disposable local *_capture_test database.");
}
const pool = new pg.Pool({ connectionString: url.href, max: 12 });
const repository = new PostgresCaptureMonitorRepository(pool);
const config = loadCaptureDeadlineConfig({});
const snapshots = new Map();
let clock = new Date("2026-09-28T12:00:00Z");
let reads = 0; let captures = 0;
const tick = (seconds = 1) => { clock = new Date(clock.getTime() + seconds * 1000); };
const deadline = (minutes) => new Date(clock.getTime() + minutes * 60000).toISOString();
const provider = { key: "mollie-test", async getPayment({ providerPaymentId }) {
  reads++;
  const snapshot = snapshots.get(providerPaymentId);
  if (!snapshot) throw new Error("synthetic provider unavailable");
  return snapshot;
}, async capture() { captures++; throw new Error("Monitor must not capture"); } };
const monitor = new CaptureDeadlineMonitor(repository, { getProvider: () => provider }, config, () => clock);
const run = async () => { tick(); return monitor.run(); };
const row = async (id) => (await pool.query("SELECT * FROM payments WHERE id=$1", [id])).rows[0];
const events = async (id) => (await pool.query("SELECT * FROM outbox_events WHERE aggregate_id=$1 AND event_type LIKE 'payment.capture_deadline.%' ORDER BY created_at", [id])).rows;
const close = async (id) => pool.query("UPDATE payments SET status='cancelled' WHERE id=$1", [id]);
async function seed({ status = "authorised", mode = "manual", before = deadline(2000), providerStatus = status } = {}) {
  const orderId = randomUUID(); const id = randomUUID(); const reference = `tr_${id.replaceAll("-", "")}`;
  await pool.query(`INSERT INTO orders (id,order_number,status,currency,subtotal_minor,discount_minor,tax_minor,delivery_minor,total_minor,delivery_address_snapshot)
    VALUES ($1,$2,'pending_payment','GBP',1000,0,0,0,1000,'{}')`, [orderId, `DEADLINE-${orderId}`]);
  await pool.query(`INSERT INTO payments (id,order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key,capture_mode,capture_before)
    VALUES ($1,$2,'mollie-test',$3,$4,1000,'GBP',$5,$6,$7)`, [id, orderId, reference, status, randomUUID(), mode, before]);
  const payment = { provider: "mollie-test", providerPaymentId: reference, orderId, status: providerStatus, captureMode: "manual",
    ...(before ? { captureBefore: before } : {}), authorisedAt: deadline(-1000), amount: { value: 1000, currency: "GBP" }, refundableAmount: { value: 0, currency: "GBP" }, createdAt: deadline(-2000) };
  snapshots.set(reference, payment);
  return { id, orderId, reference, payment };
}
try {
  assert.equal(Number((await pool.query("SELECT count(*) FROM payments")).rows[0].count), 0, "Use a freshly migrated disposable database for this rehearsal");
  const safe = await seed();
  assert.equal((await run()).actionable, false);
  assert.equal((await row(safe.id)).capture_deadline_state, "safe"); assert.equal((await events(safe.id)).length, 0);
  assert.equal((await row(safe.id)).authorised_at.toISOString(), safe.payment.authorisedAt);
  await close(safe.id);

  const warning = await seed({ before: deadline(1000) });
  assert.equal((await run()).eventsCreated, 1);
  assert.equal((await row(warning.id)).capture_deadline_state, "warning");
  assert.equal((await run()).eventsCreated, 0); assert.equal((await events(warning.id)).length, 1);
  clock = new Date(Date.parse(warning.payment.captureBefore) - 120 * 60000);
  assert.equal((await run()).eventsCreated, 1); assert.equal((await row(warning.id)).capture_deadline_state, "critical");
  assert.equal((await run()).eventsCreated, 0); assert.equal((await events(warning.id)).length, 2);
  clock = new Date(warning.payment.captureBefore); // Exact deadline boundary.
  assert.equal((await monitor.run()).eventsCreated, 1); assert.equal((await row(warning.id)).capture_deadline_state, "overdue");
  assert.equal((await run()).eventsCreated, 0);
  await assert.rejects(() => new PostgresFulfilmentRepository(pool).reservePaidOrder(warning.orderId, "test", randomUUID(), randomUUID()), /verified captured/);
  assert.equal((await pool.query("SELECT status FROM orders WHERE id=$1", [warning.orderId])).rows[0].status, "pending_payment");
  assert.deepEqual((await events(warning.id)).map((e) => e.payload.condition), ["warning", "critical", "overdue"]);
  await close(warning.id);

  const missing = await seed({ before: null });
  await run(); assert.equal((await row(missing.id)).capture_before, null);
  assert.equal((await row(missing.id)).capture_deadline_state, "missing_deadline");
  await run(); assert.equal((await events(missing.id)).length, 1); await close(missing.id);

  for (const status of ["captured", "cancelled", "failed", "expired", "refunded", "partially_refunded", "dispute_opened"]) {
    const terminal = await seed({ status, before: deadline(-1) }); const beforeReads = reads;
    await run(); assert.equal(reads, beforeReads); assert.equal((await events(terminal.id)).length, 0);
  }
  const automatic = await seed({ mode: "automatic" }); const beforeAutomatic = reads;
  await run(); assert.equal(reads, beforeAutomatic); assert.equal((await events(automatic.id)).length, 0);

  // Unknown legacy mode/deadline is hydrated only from a fresh authoritative read.
  const legacy = await seed({ mode: null, before: null });
  snapshots.set(legacy.reference, { ...legacy.payment, captureBefore: deadline(180) });
  await run(); assert.equal((await row(legacy.id)).capture_mode, "manual");
  assert.equal((await row(legacy.id)).capture_deadline_state, "critical"); await close(legacy.id);

  // A stale local overdue deadline must not override a fresh provider extension.
  const stale = await seed({ before: deadline(-1) });
  snapshots.set(stale.reference, { ...stale.payment, captureBefore: deadline(3000) });
  await run(); assert.equal((await row(stale.id)).capture_deadline_state, "safe"); assert.equal((await events(stale.id)).length, 0); await close(stale.id);

  const paid = await seed({ before: deadline(180) }); await run();
  snapshots.set(paid.reference, { ...paid.payment, status: "captured" });
  await run(); assert.equal((await row(paid.id)).status, "captured");
  assert.equal((await row(paid.id)).capture_deadline_state, null);
  const beforePaidReads = reads; await run(); assert.equal(reads, beforePaidReads); assert.equal((await events(paid.id)).length, 1);
  assert.equal((await new PostgresFulfilmentRepository(pool).reservePaidOrder(paid.orderId, "test", randomUUID(), randomUUID())).outcome, "reserved");

  const failedRead = await seed({ before: deadline(180) }); snapshots.delete(failedRead.reference);
  await run(); await run(); assert.equal((await row(failedRead.id)).capture_deadline_state, "reconciliation_required");
  assert.equal((await events(failedRead.id)).length, 1);
  snapshots.set(failedRead.reference, failedRead.payment); await run();
  assert.equal((await row(failedRead.id)).capture_deadline_state, "critical"); await close(failedRead.id);

  const parallel = await seed({ before: deadline(180) }); tick(); const beforeParallel = reads;
  await Promise.all(Array.from({ length: 8 }, () => monitor.run()));
  assert.equal(reads - beforeParallel, 1); assert.equal((await events(parallel.id)).length, 1); await close(parallel.id);

  const raced = await seed({ before: deadline(180) }); tick();
  const claim = await repository.claim(clock, clock, randomUUID()); assert.equal(claim.id, raced.id);
  await pool.query("UPDATE payments SET status='captured' WHERE id=$1", [raced.id]);
  assert.equal(await repository.record(claim, { payment: raced.payment }, config, clock, randomUUID()), "conflict");
  assert.equal((await row(raced.id)).status, "captured"); assert.equal((await events(raced.id)).length, 0);

  const leased = await seed({ before: deadline(180) }); tick();
  const oldClaim = await repository.claim(clock, clock, randomUUID()); assert.equal(oldClaim.id, leased.id);
  assert.equal(await repository.claim(clock, clock, randomUUID()), undefined);
  tick(61); const renewedClaim = await repository.claim(clock, clock, randomUUID()); assert.equal(renewedClaim.id, leased.id);
  assert.equal(await repository.record(oldClaim, { payment: leased.payment }, config, clock, randomUUID()), "conflict");
  assert.equal(await repository.record(renewedClaim, { payment: leased.payment }, config, clock, randomUUID()), "alerted"); await close(leased.id);

  const rollback = await seed({ before: deadline(180) }); tick();
  const rollbackClaim = await repository.claim(clock, clock, randomUUID()); assert.equal(rollbackClaim.id, rollback.id);
  await pool.query(`CREATE FUNCTION reject_deadline_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deadline persistence interruption'; END $$`);
  await pool.query("CREATE TRIGGER reject_deadline_test_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_deadline_test_event()");
  try { await assert.rejects(() => repository.record(rollbackClaim, { payment: rollback.payment }, config, clock, randomUUID()), /deadline persistence interruption/); }
  finally { await pool.query("DROP TRIGGER reject_deadline_test_event ON outbox_events"); await pool.query("DROP FUNCTION reject_deadline_test_event()"); }
  const afterRollback = await row(rollback.id);
  assert.equal(afterRollback.capture_deadline_state, null); assert.equal(afterRollback.capture_monitor_checked_at, null); assert.equal(afterRollback.authorised_at, null);
  assert.equal((await events(rollback.id)).length, 0);
  tick(61); await run(); assert.equal((await events(rollback.id)).length, 1); await close(rollback.id);

  // Verify the normal verified-webhook path persists timing and invalidates an old monitor read.
  const webhook = await seed({ before: null, status: "pending" });
  const webhookProvider = { key: "mollie-test", verifyWebhook: async () => ({ outcome: "actionable", provider: "mollie-test", providerEventId: "verified" }),
    normaliseWebhook: async () => [{ eventId: `authorised:${webhook.id}`, provider: "mollie-test", providerPaymentId: webhook.reference, type: "payment.authorised", amount: webhook.payment.amount,
      occurredAt: clock.toISOString(), captureMode: "manual", captureBefore: deadline(120), authorisedAt: deadline(-100) }] };
  await new PaymentWebhookProcessor(webhookProvider, new PostgresTransactionRunner(pool)).process({ rawBody: new Uint8Array(), headers: {}, endpointUrl: "https://test.invalid" });
  assert.equal((await row(webhook.id)).status, "authorised"); assert.equal((await row(webhook.id)).capture_before.toISOString(), deadline(120));
  assert.equal((await row(webhook.id)).authorised_at.toISOString(), deadline(-100)); await close(webhook.id);

  // Provider checkout timing is also retained if authorisation occurs in the checkout response.
  const checkoutOrderId = randomUUID(); const checkoutKey = randomUUID();
  await pool.query(`INSERT INTO orders (id,order_number,status,currency,subtotal_minor,discount_minor,tax_minor,delivery_minor,total_minor,delivery_address_snapshot)
    VALUES ($1,$2,'draft','GBP',1000,0,0,0,1000,'{}')`, [checkoutOrderId, `CHECKOUT-${checkoutOrderId}`]);
  await pool.query("INSERT INTO checkout_sessions (idempotency_key,request_fingerprint,order_id) VALUES ($1,$2,$3)", [checkoutKey, "a".repeat(64), checkoutOrderId]);
  await new PostgresCheckoutRepository(pool).attachPayment({ orderId: checkoutOrderId, provider: "mollie-test", providerPaymentId: randomUUID(), amountMinor: 1000, currency: "GBP", idempotencyKey: checkoutKey, checkoutUrl: "https://test.invalid", status: "authorised", captureMode: "manual", captureBefore: deadline(120), authorisedAt: deadline(-10) });
  const attached = (await pool.query("SELECT status,capture_mode,capture_before,authorised_at FROM payments WHERE order_id=$1", [checkoutOrderId])).rows[0];
  assert.equal(attached.status, "authorised"); assert.equal(attached.capture_mode, "manual"); assert.equal(attached.capture_before.toISOString(), deadline(120)); assert.equal(attached.authorised_at.toISOString(), deadline(-10));
  assert.equal(captures, 0);
  console.log("PostgreSQL capture-deadline rehearsal passed: windows, idempotency, terminal exclusion, verified reconciliation, concurrency/leases, stale reads, atomic rollback, webhook/checkout persistence, fulfilment gate; zero provider capture calls.");
} finally { await pool.end(); }
