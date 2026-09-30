import assert from "node:assert/strict";
import test from "node:test";
import { money, type PaymentProvider, type CaptureInput, type NormalisedPayment, type NormalisedCapture } from "../../../../packages/commerce-core/src/index.js";
import { OperationsService, type OperationsRepository, type CaptureRecovery, type CaptureReconciliationResult } from "./service.js";
import { createProtectedOperationsHandler } from "../access/protected-operations.js";
import { mollieCaptureReplaySafe } from "../payments/mollie-capture-replay.js";

const now = new Date("2026-09-29T12:00:00Z");
const amount = money(1000,"GBP");
const request: CaptureInput = { orderId:"o1",paymentId:"p1",providerPaymentId:"tr_1",operatorId:"original-operator",idempotencyKey:"original-key",correlationId:"original-correlation",amount,authorisedAmount:amount };
function fixture() {
  const recovery: CaptureRecovery = { ...request,provider:"mollie-test",amountMinor:1000,currency:"GBP",originalOperatorId:request.operatorId,fingerprint:"original-fingerprint",request,firstAttemptAt:"2026-09-29T11:50:00Z",providerContext:"context",revision:"1",claimId:"recovery-correlation" };
  let payment: NormalisedPayment = { provider:"mollie-test",providerPaymentId:"tr_1",status:"authorised",amount,refundableAmount:money(0,"GBP"),createdAt:now.toISOString(),captureMode:"manual",captureBefore:"2026-09-30T12:00:00Z" };
  let captures: NormalisedCapture[] = [];
  let complete=true, permitted=true, lookupFailure=false;
  let saved: CaptureReconciliationResult|undefined;
  const posted: CaptureInput[] = [];
  const captured: NormalisedCapture = {provider:"mollie-test",providerPaymentId:"tr_1",providerCaptureId:"cpt_1",amount,status:"completed",createdAt:now.toISOString()};
  const unused = async ():Promise<never> => {throw new Error("unexpected operation");};
  const repository: OperationsRepository = {
    reserveCapture:unused,refreshCapture:unused,finishCapture:unused,prepareCaptureAttempt:unused,
    reserveCaptureReconciliation:async()=>saved?.status==='completed'?{outcome:"replayed",result:saved}:{outcome:"reserved",recovery},
    permitCaptureReplay:async()=>permitted,
    finishCaptureReconciliation:async(r,operator,result)=>{assert.equal(r.fingerprint,"original-fingerprint");assert.equal(operator,"recovering-operator");saved=result;return result;},
    searchOrders:unused,getOrder:unused,reserveRefund:unused,completeRefund:unused,failRefund:unused,markRefundResolutionRequired:unused,retryOutbox:unused,reconciliationRows:unused,
  };
  const provider:PaymentProvider={key:"mollie-test",createCheckout:unused,refund:unused,verifyWebhook:unused,normaliseWebhook:unused,
    getPayment:async()=>{if(lookupFailure)throw new Error("private provider payload");return payment;},
    listCaptures:async()=>({captures,complete}),
    canReplayCapture:(evidence,date)=>mollieCaptureReplaySafe(evidence,"context",date),
    capture:async(input)=>{posted.push(input);return captured;},
  };
  const service=new OperationsService(repository,{getProvider:()=>provider,getConfiguredProvider:()=>provider},()=>now);
  return {service,recovery,provider,repository,posted,captured,run:()=>service.reconcileCapture("o1","recovering-operator"),
    setPayment:(value:Partial<NormalisedPayment>)=>{payment={...payment,...value};},setCaptures:(value:NormalisedCapture[])=>{captures=value;},
    truncate:()=>{complete=false;},deny:()=>{permitted=false;},fail:()=>{lookupFailure=true;}};
}
test("safe reconciliation reuses original immutable command/key/operator and replays completed result",async()=>{
  const f=fixture();const result=await f.run();assert.equal(result.outcome,"capture_resumed");assert.equal(result.status,"completed");
  assert.equal(f.posted.length,1);assert.deepEqual(f.posted[0],{...request,correlationId:f.recovery.claimId,replay:{firstAttemptAt:f.recovery.firstAttemptAt,providerContext:"context"}});
  assert.deepEqual(await f.run(),result);assert.equal(f.posted.length,1);
});
for(const evidence of [{firstAttemptAt:"2026-09-29T11:00:00Z"},{firstAttemptAt:null},{providerContext:null},{providerContext:"rotated"},{request:null}]) {
  test(`unproven replay evidence ${JSON.stringify(evidence)} never captures`,async()=>{const f=fixture();Object.assign(f.recovery,evidence);assert.equal((await f.run()).outcome,"manual_resolution_required");assert.equal(f.posted.length,0);});
}
test("existing completed provider capture is persisted without POST, including repeated reconciliation",async()=>{const f=fixture();f.setCaptures([f.captured]);const result=await f.run();assert.equal(result.outcome,"capture_reconciled");assert.deepEqual(result.captures,[f.captured]);assert.deepEqual(await f.run(),result);assert.equal(f.posted.length,0);});
for(const status of ["captured","failed","cancelled","expired","pending"] as const) {
  test(`provider ${status} never causes a capture POST`,async()=>{const f=fixture();f.setPayment({status});const result=await f.run();assert.equal(result.outcome,status==='captured'?'payment_captured':'payment_not_eligible');assert.equal(f.posted.length,0);});
}
for(const scenario of ["timeout","list-timeout","incomplete","multiple","partial","currency","wrong-payment","deadline","automatic","revision","pending-capture","failed-capture","request-mismatch"]){
  test(`ambiguous or ineligible ${scenario} fails closed`,async()=>{
    const f=fixture();
    if(scenario==='timeout')f.fail();
    if(scenario==='list-timeout')f.provider.listCaptures=async()=>{throw new Error('timeout');};
    if(scenario==='incomplete')f.truncate();
    if(scenario==='multiple')f.setCaptures([f.captured,f.captured]);
    if(scenario==='partial')f.setCaptures([{...f.captured,amount:money(500,'GBP')}]);
    if(scenario==='currency')f.setPayment({amount:money(1000,'EUR')});
    if(scenario==='wrong-payment')f.setPayment({providerPaymentId:'tr_other'});
    if(scenario==='deadline')f.setPayment({captureBefore:now.toISOString()});
    if(scenario==='automatic')f.setPayment({captureMode:'automatic'});
    if(scenario==='revision')f.deny();
    if(scenario==='pending-capture')f.setCaptures([{...f.captured,status:'pending'}]);
    if(scenario==='failed-capture')f.setCaptures([{...f.captured,status:'failed'}]);
    if(scenario==='request-mismatch')Object.assign(f.recovery,{request:{...request,idempotencyKey:'new-key'}});
    const result=await f.run();assert.equal(result.status,'resolution_required');assert.equal(f.posted.length,0);assert.doesNotMatch(JSON.stringify(result),/private provider payload/);
  });
}
test("ambiguous replay response is held for resolution",async()=>{const f=fixture();f.provider.capture=async(input)=>{f.posted.push(input);throw new Error('timeout');};assert.equal((await f.run()).outcome,'provider_ambiguous');assert.equal(f.posted.length,1);});
test("reconciliation is protected by the same payments:capture grant; client key is not a replacement",async()=>{
  const f=fixture();
  for(const permissions of [[],['orders:read']] as const){const handler=createProtectedOperationsHandler(f.service,{authenticate:async()=>({id:'recovering-operator',permissions})});assert.equal((await handler(new Request('https://ops.test/operations/orders/o1/capture/reconcile',{method:'POST'}))).status,403);}
  const unauthenticated=createProtectedOperationsHandler(f.service,{authenticate:async()=>undefined});
  assert.equal((await unauthenticated(new Request('https://ops.test/operations/orders/o1/capture/reconcile',{method:'POST'}))).status,401);
  const handler=createProtectedOperationsHandler(f.service,{authenticate:async()=>({id:'recovering-operator',permissions:['payments:capture']})});
  assert.equal((await handler(new Request('https://ops.test/operations/orders/o1/capture/reconcile',{method:'POST',headers:{'Idempotency-Key':'ignored-new-key'}}))).status,200);
  assert.equal(f.posted[0]?.idempotencyKey,'original-key');
});
