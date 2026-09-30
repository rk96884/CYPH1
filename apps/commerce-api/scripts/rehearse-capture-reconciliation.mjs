import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PostgresOperationsRepository } from "../../../build/commerce-api/apps/commerce-api/src/operations/postgres.js";
import { OperationsService } from "../../../build/commerce-api/apps/commerce-api/src/operations/service.js";
import { PostgresFulfilmentRepository } from "../../../build/commerce-api/apps/commerce-api/src/fulfilment/postgres.js";
import { mollieCaptureReplaySafe } from "../../../build/commerce-api/apps/commerce-api/src/payments/mollie-capture-replay.js";

const url = new URL(process.env.CAPTURE_TEST_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_capture_test")) {
  throw new Error("CAPTURE_TEST_DATABASE_URL must point to a disposable local *_capture_test database.");
}
const pool = new pg.Pool({ connectionString: url.href, max: 10 });
const repository = new PostgresOperationsRepository(pool);
const fulfilment = new PostgresFulfilmentRepository(pool);
const states=new Map();const posts=[];
const provider={key:'capture-test',captureReplayContext:()=> 'synthetic-context',canReplayCapture:(evidence,now)=>mollieCaptureReplaySafe(evidence,'synthetic-context',now),
  async getPayment(input){const state=states.get(input.providerPaymentId);return {provider:'capture-test',providerPaymentId:input.providerPaymentId,status:state.paymentStatus,amount:{value:1000,currency:'GBP'},refundableAmount:{value:0,currency:'GBP'},createdAt:new Date().toISOString(),captureMode:'manual',captureBefore:new Date(Date.now()+86400000).toISOString()};},
  async listCaptures(input){return {captures:states.get(input.providerPaymentId).captures,complete:true};},
  async capture(input){
    posts.push(input);
    const evidence=await pool.query('SELECT capture_request,capture_first_attempt_at,capture_claim_id FROM operator_commands WHERE idempotency_key=$1',[input.idempotencyKey]);
    assert.ok(evidence.rows[0].capture_first_attempt_at);assert.ok(evidence.rows[0].capture_claim_id);
    assert.equal(evidence.rows[0].capture_request.idempotencyKey,input.idempotencyKey);
    if(!input.replay)throw new Error('synthetic uncertain response');
    assert.equal(input.operatorId,'original-operator');
    const result={provider:'capture-test',providerPaymentId:input.providerPaymentId,providerCaptureId:`cpt_${randomUUID().replaceAll('-','')}`,amount:input.amount,status:'completed',createdAt:new Date().toISOString()};
    states.get(input.providerPaymentId).captures=[result];return result;
  }
};
const service=new OperationsService(repository,{getProvider:()=>provider});
async function fixture(){
  const order=randomUUID(),key=randomUUID(),ref=`tr_${randomUUID()}`;
  await pool.query(`INSERT INTO orders (id,order_number,status,currency,subtotal_minor,discount_minor,tax_minor,delivery_minor,total_minor,delivery_address_snapshot) VALUES ($1,$2,'pending_payment','GBP',1000,0,0,0,1000,'{}')`,[order,`RECONCILE-${order}`]);
  const payment=await pool.query(`INSERT INTO payments (order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key) VALUES ($1,'capture-test',$2,'authorised',1000,'GBP',$3) RETURNING id`,[order,ref,randomUUID()]);
  states.set(ref,{paymentStatus:'authorised',captures:[]});
  assert.equal((await service.capture({orderId:order,operatorId:'original-operator',idempotencyKey:key})).status,'resolution_required');
  return {order,key,ref,payment:payment.rows[0].id};
}
async function assertHeld(f){
  const state=await pool.query('SELECT status FROM orders WHERE id=$1',[f.order]);assert.equal(state.rows[0].status,'pending_payment');
  await assert.rejects(()=>fulfilment.reservePaidOrder(f.order,'test',randomUUID(),randomUUID()),/verified captured/);
}
try{
  const f=await fixture();await assertHeld(f);
  const before=posts.length;
  const concurrent=await Promise.allSettled(Array.from({length:8},()=>service.reconcileCapture(f.order,'recovering-operator')));
  assert.ok(concurrent.some(result=>result.status==='fulfilled'&&result.value.status==='completed'));
  for(const result of concurrent)if(result.status==='rejected')assert.equal(result.reason.code,'conflict');
  assert.equal(posts.length-before,1);assert.equal(posts.at(-1).idempotencyKey,f.key);
  assert.equal((await service.reconcileCapture(f.order,'recovering-operator')).status,'completed');assert.equal(posts.length-before,1);
  assert.equal((await fulfilment.reservePaidOrder(f.order,'test',randomUUID(),randomUUID())).outcome,'reserved');
  await assert.rejects(()=>service.capture({orderId:f.order,operatorId:'original-operator',idempotencyKey:randomUUID()}),/authorised|already exists/);
  const command=await pool.query('SELECT * FROM operator_commands WHERE idempotency_key=$1',[f.key]);
  assert.equal(command.rows[0].operator_id,'original-operator');assert.equal(command.rows[0].capture_request.idempotencyKey,f.key);
  assert.equal(command.rows[0].result.captures[0].providerCaptureId,states.get(f.ref).captures[0].providerCaptureId);
  const detail=await repository.getOrder(f.order);assert.deepEqual(detail.captureCommand,{status:'completed'});
  assert.doesNotMatch(JSON.stringify(detail),/synthetic-context|original-key|capture_request|request_fingerprint/);
  const audit=await pool.query("SELECT actor_id,correlation_id FROM audit_events WHERE entity_id=$1 AND action='capture.reconciled'",[f.payment]);assert.equal(audit.rows[0].actor_id,'recovering-operator');assert.ok(audit.rows[0].correlation_id);

  for(const kind of ['expired-window','legacy','terminal','existing','active','revision']){
    const current=await fixture();const before=posts.length;
    if(kind==='expired-window')await pool.query("UPDATE operator_commands SET capture_first_attempt_at=now()-interval '2 hours' WHERE idempotency_key=$1",[current.key]);
    if(kind==='legacy')await pool.query('UPDATE operator_commands SET capture_request=NULL,capture_first_attempt_at=NULL,capture_provider_context=NULL WHERE idempotency_key=$1',[current.key]);
    if(kind==='terminal')states.get(current.ref).paymentStatus='expired';
    if(kind==='existing')states.get(current.ref).captures=[{provider:'capture-test',providerPaymentId:current.ref,providerCaptureId:'cpt_existing',amount:{value:1000,currency:'GBP'},status:'completed',createdAt:new Date().toISOString()}];
    if(kind==='active')await pool.query('UPDATE operator_commands SET capture_claim_id=$2,capture_claimed_at=now() WHERE idempotency_key=$1',[current.key,randomUUID()]);
    if(kind==='revision'){
      const claim=await repository.reserveCaptureReconciliation(current.order,'recovering-operator',randomUUID());
      await pool.query("UPDATE payments SET capture_before=now()+interval '1 day' WHERE id=$1",[current.payment]);
      assert.equal(await repository.permitCaptureReplay(claim.recovery,'recovering-operator'),false);
      await repository.finishCaptureReconciliation(claim.recovery,'recovering-operator',{status:'resolution_required',outcome:'manual_resolution_required'});
    }else if(kind==='active')await assert.rejects(()=>service.reconcileCapture(current.order,'recovering-operator'),/still processing/);
    else {const result=await service.reconcileCapture(current.order,'recovering-operator');assert.equal(result.status,kind==='existing'?'completed':kind==='terminal'?'failed':'resolution_required');}
    assert.equal(posts.length,before);
    if(kind!=='existing')await assertHeld(current);
  }
  // A failed atomic commit must not expose paid state or permit a replacement command.
  const interrupted=await fixture();
  states.get(interrupted.ref).captures=[{provider:'capture-test',providerPaymentId:interrupted.ref,providerCaptureId:'cpt_interrupted',amount:{value:1000,currency:'GBP'},status:'completed',createdAt:new Date().toISOString()}];
  await pool.query(`CREATE FUNCTION reject_reconcile_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test reconciliation interruption'; END $$`);
  await pool.query('CREATE TRIGGER reject_reconcile_test_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_reconcile_test_outbox()');
  try{await assert.rejects(()=>service.reconcileCapture(interrupted.order,'recovering-operator'),/test reconciliation interruption/);}finally{await pool.query('DROP TRIGGER reject_reconcile_test_outbox ON outbox_events');await pool.query('DROP FUNCTION reject_reconcile_test_outbox()');}
  await assertHeld(interrupted);
  await assert.rejects(()=>service.reconcileCapture(interrupted.order,'recovering-operator'),/still processing/);
  await pool.query("UPDATE operator_commands SET capture_claimed_at=now()-interval '3 minutes' WHERE idempotency_key=$1",[interrupted.key]);
  const beforeRecovery=posts.length;assert.equal((await service.reconcileCapture(interrupted.order,'recovering-operator')).status,'completed');assert.equal(posts.length,beforeRecovery);
  console.log('PostgreSQL reconciliation rehearsal passed: original-key replay, concurrent claims, legacy/expired refusal, provider capture persistence, terminal states, revision fencing, atomic rollback, audit/UI privacy and fulfilment gates. Synthetic data only; no provider network calls.');
}finally{await pool.end();}
