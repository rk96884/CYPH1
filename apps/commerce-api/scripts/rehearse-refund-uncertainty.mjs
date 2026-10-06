import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = new URL(process.env.REFUND_TEST_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || url.href.includes("?") || !["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_refunds_test")) throw new Error("REFUND_TEST_DATABASE_URL must identify a disposable local *_refunds_test database without query parameters.");
const { PostgresOperationsRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/operations/postgres.js");
const { OperationsService } = await import("../../../build/commerce-api/apps/commerce-api/src/operations/service.js");
const { PaymentWebhookProcessor } = await import("../../../build/commerce-api/apps/commerce-api/src/webhooks/processor.js");
const { PostgresTransactionRunner } = await import("../../../build/commerce-api/apps/commerce-api/src/webhooks/postgres.js");
const { PaymentProviderError } = await import("../../../build/commerce-api/packages/commerce-core/src/index.js");
const pool = new pg.Pool({ connectionString: url.href, max: 12, application_name: "refund-uncertainty-rehearsal" });
const repository = new PostgresOperationsRepository(pool);
const fake = refund => ({ key: "manual-test", getPayment: async () => ({ amount: { value: 100, currency: "GBP" }, refundableAmount: { value: 100, currency: "GBP" } }), refund });
const service = (repo, provider) => new OperationsService(repo, { getProvider: () => provider });
const input = orderId => ({ orderId, amountMinor: 70, reason: "customer_request", operatorId: "refund-rehearsal", idempotencyKey: randomUUID() });
let checks = 0;
const pass = name => { checks++; console.log("PASS " + name); };
const record = async orderId => (await pool.query("SELECT r.* FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=$1", [orderId])).rows[0];
const events = async refundId => Number((await pool.query("SELECT count(*) AS n FROM outbox_events WHERE event_type='refund.completed' AND aggregate_id=$1", [refundId])).rows[0].n);
let productId;
const order = async () => {
  const id = randomUUID();
  await pool.query("INSERT INTO orders(id,order_number,status,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES($1,$2,'paid','GBP',100,100,'{}')", [id, "REFUND-TEST-" + id]);
  await pool.query("INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,'TEST','Synthetic refund item',100,1,100)", [id, productId]);
  await pool.query("INSERT INTO payments(order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key) VALUES($1,'manual-test',$2,'captured',100,'GBP',$3)", [id, "tr_" + id, randomUUID()]);
  return id;
};
const reserve = command => repository.reserveRefund({ ...command, fingerprint: createHash("sha256").update(JSON.stringify(command)).digest("hex"), correlationId: randomUUID() });
try {
  if (process.argv.includes("--crash-child")) {
    const command = JSON.parse(process.env.REFUND_CRASH_COMMAND);
    repository.completeRefund = async () => { process.exit(73); };
    await service(repository, fake(async request => { console.log("SYNTHETIC_PROVIDER_ACCEPTED"); return { providerRefundId: "re_crash", status: "completed", amount: request.amount }; })).refund(command);
    assert.fail("child must terminate");
  }
  if (process.argv.includes("--restart-child")) {
    const command = JSON.parse(process.env.REFUND_CRASH_COMMAND); let calls = 0;
    await assert.rejects(() => service(repository, fake(async () => { calls++; assert.fail("must not submit after restart"); })).refund(command), /already being processed/);
    assert.equal((await record(command.orderId)).status, "resolution_required");
    await assert.rejects(() => reserve({ ...command, idempotencyKey: randomUUID(), amountMinor: 40 }), /unreserved/);
    assert.equal(calls, 0);
    console.log("RESTART_BLOCKED");
    await pool.end();
    process.exit(0);
  }
  productId = (await pool.query("INSERT INTO products(sku,slug,name,description,status,price_minor,currency,tax_code,content_version) VALUES($1,$2,'Synthetic refund item','Not for sale','private',100,'GBP','TEST','refund-rehearsal') RETURNING id", ["REF-" + randomUUID(), "ref-" + randomUUID()])).rows[0].id;
  for (const beforeSubmission of [false, true]) {
    const id = await order(); let calls = 0;
    const provider = fake(async () => { calls++; throw new PaymentProviderError("validation_error", "Synthetic rejection"); });
    if (beforeSubmission) provider.getPayment = async () => { throw new Error("Synthetic lookup failure"); };
    await assert.rejects(() => service(repository, provider).refund(input(id)));
    assert.equal((await record(id)).status, "failed"); assert.equal(calls, beforeSubmission ? 0 : 1);
    await reserve({ ...input(id), amountMinor: 100 });
  }
  pass("pre-submission failure and definite rejection release balance safely");

  const successId = await order(); const successCommand = input(successId); let successCalls = 0;
  const successProvider = fake(async request => { successCalls++; assert.equal((await record(successId)).status, "resolution_required"); return { providerRefundId: "re_" + successId, status: "completed", amount: request.amount }; });
  const result = await service(repository, successProvider).refund(successCommand);
  assert.deepEqual(await service(repository, successProvider).refund(successCommand), result);
  const completed = await record(successId); assert.equal(completed.status, "completed"); assert.equal(successCalls, 1); assert.equal(await events(completed.id), 1);
  assert.equal((await pool.query("SELECT failure_code FROM operator_commands WHERE idempotency_key=$1", [successCommand.idempotencyKey])).rows[0].failure_code, null);
  await repository.completeRefund({ refundId: completed.id, providerRefundId: completed.provider_refund_id, status: "pending", operatorId: "test", correlationId: randomUUID() });
  assert.equal((await record(successId)).status, "completed"); assert.equal(await events(completed.id), 1);
  pass("successful completion replays without submission and cannot be downgraded");

  const failedId = await order(); const failedCommand = input(failedId); let failedCalls = 0;
  const broken = new PostgresOperationsRepository(pool);
  const originalAudit = broken.audit.bind(broken);
  // Throw inside the completion transaction after its writes; all must roll back.
  broken.audit = async (...args) => { if (args[3] === "refund.completed") throw new Error("Synthetic completion rollback"); return originalAudit(...args); };
  const accepted = fake(async request => { failedCalls++; return { providerRefundId: "re_" + failedId, status: "completed", amount: request.amount }; });
  await assert.rejects(() => service(broken, accepted).refund(failedCommand));
  const uncertain = await record(failedId);
  assert.equal(uncertain.status, "resolution_required"); assert.equal(uncertain.provider_refund_id, "re_" + failedId); assert.equal(await events(uncertain.id), 0);
  await assert.rejects(() => service(repository, accepted).refund(failedCommand), /already being processed/);
  await assert.rejects(() => service(repository, accepted).refund({ ...failedCommand, idempotencyKey: randomUUID() }), /unreserved/); assert.equal(failedCalls, 1);
  pass("completion rollback retains known ID, protected balance and blocked retry");

  for (const failure of [new Error("Synthetic response loss"), new PaymentProviderError("network_error", "Synthetic timeout", true), new PaymentProviderError("unknown_provider_error", "Synthetic malformed response")]) {
    const id = await order(); const command = input(id); let calls = 0;
    const ambiguous = fake(async () => { calls++; throw failure; });
    await assert.rejects(() => service(repository, ambiguous).refund(command));
    assert.equal((await record(id)).status, "resolution_required");
    await assert.rejects(() => service(repository, ambiguous).refund(command), /already being processed/);
    await assert.rejects(() => reserve({ ...input(id), amountMinor: 40 }), /unreserved/); assert.equal(calls, 1);
  }
  pass("generic, retryable and malformed submission errors remain reserved without blind retry");

  let current = { eventId: "event-" + randomUUID(), provider: "manual-test", providerPaymentId: "tr_" + failedId, providerRefundId: uncertain.provider_refund_id, type: "refund.completed", occurredAt: new Date().toISOString(), amount: { value: 70, currency: "GBP" } };
  const webhookProvider = { key: "manual-test", verifyWebhook: async () => ({ outcome: "actionable", provider: "manual-test", providerEventId: current.eventId, payload: {} }), normaliseWebhook: async () => [current] };
  const processor = new PaymentWebhookProcessor(webhookProvider, new PostgresTransactionRunner(pool));
  const webhookInput = { rawBody: new TextEncoder().encode("synthetic"), headers: {}, endpointUrl: "https://example.test/webhook" };
  await processor.process(webhookInput); await processor.process(webhookInput);
  current = { ...current, eventId: "event-" + randomUUID() }; await processor.process(webhookInput);
  current = { ...current, eventId: "event-" + randomUUID(), type: "refund.pending" }; await processor.process(webhookInput);
  current = { ...current, eventId: "event-" + randomUUID(), type: "refund.failed" }; await processor.process(webhookInput);
  assert.equal((await record(failedId)).status, "completed"); assert.equal(await events(uncertain.id), 1);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM audit_events WHERE entity_id=$1 AND action='refund.completed'", [uncertain.id])).rows[0].n), 1);
  await service(repository, accepted).refund(failedCommand); assert.equal(failedCalls, 1);
  await repository.completeRefund({ refundId: uncertain.id, providerRefundId: uncertain.provider_refund_id, status: "completed", operatorId: "test", correlationId: randomUUID() });
  assert.equal(await events(uncertain.id), 1);
  pass("webhook confirmation converges original command exactly once and ignores stale downgrades");

  const convergenceId = await order(); const convergenceCommand = input(convergenceId);
  const convergence = await reserve(convergenceCommand); const convergenceReference = "re_" + convergenceId;
  await repository.markRefundResolutionRequired({ refundId: convergence.refundId, providerRefundId: convergenceReference, operatorId: "test", correlationId: randomUUID() });
  current = { ...current, eventId: "event-" + randomUUID(), providerPaymentId: "tr_" + convergenceId, providerRefundId: convergenceReference, type: "refund.completed" };
  await Promise.all([
    processor.process(webhookInput),
    repository.completeRefund({ refundId: convergence.refundId, providerRefundId: convergenceReference, status: "pending", operatorId: "test", correlationId: randomUUID() }),
  ]);
  assert.equal((await record(convergenceId)).status, "completed");
  assert.equal(await events(convergence.refundId), 1);
  assert.equal((await pool.query("SELECT result->>'status' AS status FROM operator_commands WHERE idempotency_key=$1", [convergenceCommand.idempotencyKey])).rows[0].status, "completed");
  pass("simultaneous webhook completion and operator pending persistence converge without downgrade");

  const concurrentId = await order(); const concurrentCommand = input(concurrentId);
  let submitted; const submission = new Promise(resolve => { submitted = resolve; }); let finish; const gate = new Promise(resolve => { finish = resolve; });
  const inFlight = service(repository, fake(async request => { submitted(); await gate; return { providerRefundId: "re_" + concurrentId, status: "pending", amount: request.amount }; })).refund(concurrentCommand);
  await submission;
  try { await assert.rejects(() => reserve({ ...input(concurrentId), amountMinor: 40 }), /unreserved/); } finally { finish(); }
  await inFlight; assert.equal((await record(concurrentId)).status, "pending");
  pass("concurrent ordinary refund cannot spend an in-flight uncertain amount");

  const raceId = await order(); const race = await Promise.allSettled([reserve(input(raceId)), reserve(input(raceId))]);
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
  const sameId = await order(); const same = input(sameId); const sameRace = await Promise.allSettled([reserve(same), reserve(same)]);
  assert.equal(sameRace.filter(result => result.status === "fulfilled").length, 1);
  pass("fresh locked balance and same-key serialization prevent duplicate concurrent reservations");

  const outageId = await order(); const outageCommand = input(outageId);
  const outage = new PostgresOperationsRepository(pool);
  const mark = outage.markRefundResolutionRequired.bind(outage); let markers = 0;
  outage.markRefundResolutionRequired = async value => { if (++markers > 1) throw new Error("Synthetic fallback outage"); return mark(value); };
  outage.completeRefund = async () => { throw new Error("Synthetic completion outage"); };
  await assert.rejects(() => service(outage, fake(async request => ({ providerRefundId: "re_outage", status: "completed", amount: request.amount }))).refund(outageCommand), /requires reconciliation/);
  assert.equal((await record(outageId)).status, "resolution_required");
  await assert.rejects(() => reserve({ ...input(outageId), amountMinor: 40 }), /unreserved/);
  pass("durable uncertainty protects balance even when completion and fallback writes both fail");

  const acknowledgedId = await order(); const acknowledgedCommand = input(acknowledgedId);
  const acknowledged = new PostgresOperationsRepository(pool);
  const complete = acknowledged.completeRefund.bind(acknowledged);
  acknowledged.completeRefund = async value => { await complete(value); throw new Error("Synthetic lost commit acknowledgement"); };
  await assert.rejects(() => service(acknowledged, fake(async request => ({ providerRefundId: "re_" + acknowledgedId, status: "completed", amount: request.amount }))).refund(acknowledgedCommand));
  const persisted = await record(acknowledgedId);
  assert.equal(persisted.status, "completed"); assert.equal(await events(persisted.id), 1);
  let repeated = 0;
  await service(repository, fake(async () => { repeated++; assert.fail("must replay committed result"); })).refund(acknowledgedCommand);
  assert.equal(repeated, 0);
  pass("lost completion commit acknowledgement cannot downgrade a committed result");

  const crashId = await order(); const crashCommand = input(crashId);
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--crash-child"], { env: { ...process.env, REFUND_CRASH_COMMAND: JSON.stringify(crashCommand) }, encoding: "utf8", timeout: 20000, windowsHide: true });
  assert.equal(child.status, 73, child.stderr); assert.match(child.stdout, /SYNTHETIC_PROVIDER_ACCEPTED/);
  const restart = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--restart-child"], { env: { ...process.env, REFUND_CRASH_COMMAND: JSON.stringify(crashCommand) }, encoding: "utf8", timeout: 20000, windowsHide: true });
  assert.equal(restart.status, 0, restart.stderr); assert.match(restart.stdout, /RESTART_BLOCKED/);
  assert.equal((await record(crashId)).status, "resolution_required"); assert.equal(await events((await record(crashId)).id), 0);
  let restartedCalls = 0;
  await assert.rejects(() => service(new PostgresOperationsRepository(pool), fake(async () => { restartedCalls++; assert.fail("must not replay after restart"); })).refund(crashCommand), /already being processed/);
  await assert.rejects(() => reserve({ ...input(crashId), amountMinor: 40 }), /unreserved/); assert.equal(restartedCalls, 0);
  pass("actual child exit after provider success and restart preserve balance and block repeat submission");
  console.log("Refund uncertainty PostgreSQL rehearsal passed: " + checks + " checks. No external providers used.");
} finally { await pool.end(); }
