import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PostgresOperationsRepository } from "../../../build/commerce-api/apps/commerce-api/src/operations/postgres.js";
import { OperationsService } from "../../../build/commerce-api/apps/commerce-api/src/operations/service.js";
import { PostgresFulfilmentRepository } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/postgres.js";

// Explicitly opt into a disposable local database; never use deployment DATABASE_URL.
const url = new URL(process.env.CAPTURE_TEST_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_capture_test")) {
  throw new Error("CAPTURE_TEST_DATABASE_URL must point to a disposable local *_capture_test database.");
}
const pool = new pg.Pool({ connectionString: url.href, max: 8 });
const repository = new PostgresOperationsRepository(pool);
const fulfilment = new PostgresFulfilmentRepository(pool);
const operatorId = "capture-rehearsal";
let calls = 0;
let outcome = "completed";
const provider = { key: "capture-test", async getPayment(input) {
  return { provider: "capture-test", providerPaymentId: input.providerPaymentId, status: "authorised", captureMode: "manual", captureBefore: "2026-10-01T00:00:00Z", amount: { value: 1000, currency: "GBP" } };
}, async capture(input) {
  // An independent connection must see the committed reservation.
  const command = await pool.query("SELECT status FROM operator_commands WHERE idempotency_key=$1", [input.idempotencyKey]);
  assert.equal(command.rows[0]?.status, "reserved");
  calls++;
  return { provider: "capture-test", providerPaymentId: input.providerPaymentId, providerCaptureId: `capture-${randomUUID()}`, amount: input.amount, status: outcome, createdAt: new Date().toISOString() };
} };
const service = new OperationsService(repository, { getProvider: () => provider }, () => new Date("2026-09-28T12:00:00Z"));
const createOrder = async () => {
  const id = randomUUID();
  await pool.query(`INSERT INTO orders (id,order_number,status,currency,subtotal_minor,discount_minor,tax_minor,delivery_minor,total_minor,delivery_address_snapshot)
    VALUES ($1,$2,'pending_payment','GBP',1000,0,0,0,1000,'{}')`, [id, `CAPTURE-${id}`]);
  await pool.query(`INSERT INTO payments (order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key)
    VALUES ($1,'capture-test',$2,'authorised',1000,'GBP',$3)`, [id, `payment-${id}`, randomUUID()]);
  return id;
};
const capture = (orderId, idempotencyKey) => service.capture({ orderId, idempotencyKey, operatorId });
try {
  const order = await createOrder();
  await assert.rejects(() => fulfilment.reservePaidOrder(order, "test", randomUUID(), randomUUID()), /verified captured/);
  const key = randomUUID();
  const concurrent = await Promise.allSettled(Array.from({ length: 8 }, () => capture(order, key)));
  assert.ok(concurrent.some((r) => r.status === "fulfilled"));
  for (const r of concurrent) if (r.status === "rejected") assert.equal(r.reason.code, "conflict");
  assert.equal(calls, 1);
  assert.equal((await capture(order, key)).status, "completed");
  await assert.rejects(() => capture(randomUUID(), key), /different request/);
  const state = await pool.query("SELECT o.status, p.status AS payment_status FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1", [order]);
  assert.deepEqual(state.rows[0], { status: "paid", payment_status: "captured" });
  assert.equal((await fulfilment.reservePaidOrder(order, "test", randomUUID(), randomUUID())).outcome, "reserved");

  const second = await createOrder();
  const before = calls;
  const replacements = await Promise.allSettled(Array.from({ length: 8 }, () => capture(second, randomUUID())));
  assert.equal(replacements.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(calls - before, 1);

  outcome = "pending";
  const ambiguous = await createOrder(); const ambiguousKey = randomUUID();
  assert.equal((await capture(ambiguous, ambiguousKey)).status, "pending");
  const beforeReplay = calls;
  assert.equal((await capture(ambiguous, ambiguousKey)).status, "pending");
  await assert.rejects(() => capture(ambiguous, randomUUID()), /authorised|already exists/);
  assert.equal(calls, beforeReplay);
  await assert.rejects(() => fulfilment.reservePaidOrder(ambiguous, "test", randomUUID(), randomUUID()), /verified captured/);

  // A forced outbox error proves payment/order/command completion roll back together.
  outcome = "completed";
  const interrupted = await createOrder(); const interruptedKey = randomUUID();
  await pool.query(`CREATE FUNCTION reject_capture_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test persistence interruption'; END $$`);
  await pool.query("CREATE TRIGGER reject_capture_test_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_capture_test_outbox()");
  try { await assert.rejects(() => capture(interrupted, interruptedKey), /test persistence interruption/); }
  finally {
    await pool.query("DROP TRIGGER reject_capture_test_outbox ON outbox_events");
    await pool.query("DROP FUNCTION reject_capture_test_outbox()");
  }
  const rolledBack = await pool.query("SELECT o.status, p.status AS payment_status FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1", [interrupted]);
  assert.deepEqual(rolledBack.rows[0], { status: "pending_payment", payment_status: "authorised" });
  const beforeRecovery = calls;
  await assert.rejects(() => capture(interrupted, interruptedKey), /in progress|manual resolution/);
  await assert.rejects(() => capture(interrupted, randomUUID()), /already exists/);
  assert.equal(calls, beforeRecovery);
  console.log("PostgreSQL capture rehearsal passed: concurrent replay, replacement keys, atomic completion/rollback, resolution and fulfilment gates.");
} finally { await pool.end(); }
