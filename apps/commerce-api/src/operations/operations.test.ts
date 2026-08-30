import assert from "node:assert/strict";
import test from "node:test";
import { money, PaymentProviderError, type PaymentProvider } from "../../../../packages/commerce-core/src/index.js";
import { handleOperationsRequest } from "./handler.js";
import { OperationsService, type OperationsRepository } from "./service.js";

const provider: PaymentProvider = {
  key:"mollie-test", createCheckout:async()=>{throw new Error("unused");}, verifyWebhook:async()=>({outcome:"irrelevant",provider:"mollie-test"}), normaliseWebhook:async()=>[],
  getPayment:async()=>({provider:"mollie-test",providerPaymentId:"tr_1",status:"captured",amount:money(1000,"GBP"),refundableAmount:money(1000,"GBP"),createdAt:new Date().toISOString()}),
  refund:async(input)=>({provider:"mollie-test",providerPaymentId:input.providerPaymentId,providerRefundId:"re_1",amount:input.amount,status:"completed",createdAt:new Date().toISOString()}),
};
const state:{completed?:string}={};
const repository:OperationsRepository={
  searchOrders:async()=>[], getOrder:async()=>undefined, reconciliationRows:async()=>[], retryOutbox:async(input)=>({replayed:false,eventId:input.eventId}),
  reserveRefund:async(input)=>({outcome:"reserved",refundId:"r1",paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:input.amountMinor,refundableMinor:1000}),
  completeRefund:async(input)=>{state.completed=input.providerRefundId;}, failRefund:async()=>{}, markRefundResolutionRequired:async()=>{},
};
const service=new OperationsService(repository,{getConfiguredProvider:()=>provider,getProvider:()=>provider});

test("operations handler rejects unauthenticated and unauthorised callers",async()=>{
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service)).status,401);
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service,{id:"viewer",permissions:[]})).status,403);
});

test("permission-controlled refund uses provider contract",async()=>{
  const response=await handleOperationsRequest(new Request("https://ops.test/operations/orders/o1/refunds",{method:"POST",headers:{"content-type":"application/json","idempotency-key":"refund-1"},body:JSON.stringify({amountMinor:500,reason:"customer_request"})}),service,{id:"operator@example.test",permissions:["refunds:create"]});
  assert.equal(response.status,201); assert.equal(state.completed,"re_1");
});

test("reconciliation requires bounded dates and escapes spreadsheet formulae",async()=>{
  const rows={...repository,reconciliationRows:async()=>[{order_number:"=unsafe",created_at:"2026-01-01",order_status:"paid"}]};
  const local=new OperationsService(rows,{getConfiguredProvider:()=>provider,getProvider:()=>provider});
  const response=await handleOperationsRequest(new Request("https://ops.test/operations/reconciliation.csv?from=2026-01-01&to=2026-01-02"),local,{id:"finance",permissions:["reconciliation:export"]});
  assert.equal(response.status,200); assert.match(await response.text(),/"'=unsafe"/);
});

test("retryable refund failures are held for reconciliation and not marked definitively failed",async()=>{
  let resolutionRequired=0; let failed=0;
  const ambiguousProvider:PaymentProvider={
    ...provider,
    refund:async()=>{throw new PaymentProviderError("network_error","timeout",true);},
  };
  const ambiguousRepository:OperationsRepository={
    ...repository,
    failRefund:async()=>{failed+=1;},
    markRefundResolutionRequired:async()=>{resolutionRequired+=1;},
  };
  const ambiguousService=new OperationsService(ambiguousRepository,{getConfiguredProvider:()=>ambiguousProvider,getProvider:()=>ambiguousProvider});
  await assert.rejects(()=>ambiguousService.refund({orderId:"o1",amountMinor:500,reason:"customer_request",operatorId:"operator",idempotencyKey:"refund-timeout"}),/could not complete/);
  assert.equal(resolutionRequired,1);
  assert.equal(failed,0);
});

test("partial and full refund amounts remain explicit provider requests",async()=>{
  const amounts:number[]=[];
  const amountProvider:PaymentProvider={
    ...provider,
    refund:async(input)=>{
      amounts.push(input.amount.value);
      return {provider:"mollie-test",providerPaymentId:input.providerPaymentId,providerRefundId:`re_${amounts.length}`,amount:input.amount,status:"completed" as const,createdAt:new Date().toISOString()};
    },
  };
  const amountRepository:OperationsRepository={
    ...repository,
    reserveRefund:async(input)=>({outcome:"reserved" as const,refundId:`r${amounts.length+1}`,paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:input.amountMinor,refundableMinor:1000}),
  };
  const amountService=new OperationsService(amountRepository,{getConfiguredProvider:()=>amountProvider,getProvider:()=>amountProvider});
  await amountService.refund({orderId:"o1",amountMinor:400,reason:"customer_request",operatorId:"operator",idempotencyKey:"partial"});
  await amountService.refund({orderId:"o1",amountMinor:1000,reason:"cancelled_order",operatorId:"operator",idempotencyKey:"full"});
  assert.deepEqual(amounts,[400,1000]);
});
