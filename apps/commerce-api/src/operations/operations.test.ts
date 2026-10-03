import assert from "node:assert/strict";
import test from "node:test";
import { money, PaymentProviderError, type PaymentProvider } from "../../../../packages/commerce-core/src/index.js";
import { handleOperationsRequest, reconciliationCsvColumns } from "./handler.js";
import { OperationsError, OperationsService, type OperationsRepository } from "./service.js";
import { MollieTestPaymentProvider } from "../payments/mollie-test.js";

const provider: PaymentProvider = {
  key:"mollie-test", createCheckout:async()=>{throw new Error("unused");}, verifyWebhook:async()=>({outcome:"irrelevant",provider:"mollie-test"}), normaliseWebhook:async()=>[],
  getPayment:async()=>({provider:"mollie-test",providerPaymentId:"tr_1",status:"captured",amount:money(1000,"GBP"),refundableAmount:money(1000,"GBP"),createdAt:new Date().toISOString()}),
  refund:async(input)=>({provider:"mollie-test",providerPaymentId:input.providerPaymentId,providerRefundId:"re_1",amount:input.amount,status:"completed",createdAt:new Date().toISOString()}),
};
const state:{completed?:string}={};
const repository:OperationsRepository={
  reserveCapture:async()=>{throw new Error("unused");}, finishCapture:async(input)=>input.result,
  refreshCapture:async()=>true, prepareCaptureAttempt:async()=>{},
  reserveCaptureReconciliation:async()=>{throw new Error("unused");}, permitCaptureReplay:async()=>false,
  finishCaptureReconciliation:async(_recovery,_operator,result)=>result,
  searchOrders:async()=>[], getOrder:async()=>undefined, reconciliationRows:async()=>[], retryOutbox:async(input)=>({replayed:false,eventId:input.eventId}),
  reserveRefund:async(input)=>({outcome:"reserved",refundId:"r1",paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:(input.amountMinor??0),refundableMinor:1000}),
  completeRefund:async(input)=>{state.completed=input.providerRefundId;}, failRefund:async()=>{}, markRefundResolutionRequired:async()=>{},
};
const service=new OperationsService(repository,{getConfiguredProvider:()=>provider,getProvider:()=>provider});

const returnOrderId="00000000-0000-0000-0000-000000000001";
const returnId="00000000-0000-0000-0000-000000000002";
test("return refund requires both grants and rejects amount/currency overrides before reservation",async()=>{
  let reservations=0;
  const local=new OperationsService({...repository,reserveRefund:async()=>{reservations++;throw new Error("must not reserve");}},{getConfiguredProvider:()=>provider,getProvider:()=>provider});
  const request=(body:unknown={expectedVersion:2},key="return-refund")=>new Request(`https://ops.test/operations/orders/${returnOrderId}/returns/${returnId}/refund`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)});
  assert.equal((await handleOperationsRequest(request(),local)).status,401);
  for(const permissions of [[],["returns:approve"],["refunds:create"],["returns:manage","refunds:create"]] as const)assert.equal((await handleOperationsRequest(request(),local,{id:"operator",permissions})).status,403);
  const principal={id:"operator",permissions:["returns:approve","refunds:create"] as const};
  for(const body of [{expectedVersion:2,amountMinor:50},{expectedVersion:2,currency:"GBP"},{expectedVersion:0},{expectedVersion:2,reason:"returned_goods"},null])assert.equal((await handleOperationsRequest(request(body),local,principal)).status,400);
  for(const key of ["","bad key","x".repeat(129)])assert.equal((await handleOperationsRequest(request({expectedVersion:2},key),local,principal)).status,400);
  assert.equal(reservations,0);
});

test("return refund uses derived reservation and the existing submission/completion engine; replay skips provider",async()=>{
  let calls=0;let completed=0;let replay=false;
  const local=new OperationsService({...repository,reserveRefund:async input=>{
    assert.equal(input.returnId,returnId);assert.equal(input.amountMinor,undefined);assert.equal(input.reason,undefined);
    return {outcome:replay?"replayed":"reserved",refundId:"r1",paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:50,refundableMinor:1000,result:{status:"completed"}};
  },completeRefund:async()=>{completed++;}},{getConfiguredProvider:()=>provider,getProvider:()=>({...provider,refund:async input=>{calls++;assert.equal(input.amount.value,50);assert.equal(input.amount.currency,"GBP");assert.equal(input.reason,"returned_goods");return provider.refund(input);}})});
  const input={orderId:returnOrderId,returnId,expectedVersion:2,operatorId:"operator",idempotencyKey:"return-refund"};
  const response=await handleOperationsRequest(new Request(`https://ops.test/operations/orders/${returnOrderId}/returns/${returnId}/refund`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":input.idempotencyKey},body:JSON.stringify({expectedVersion:2})}),local,{id:"operator",permissions:["returns:approve","refunds:create"]});
  assert.equal(response.status,201);replay=true;await local.refundReturn(input);assert.equal(calls,1);assert.equal(completed,1);
});

test("return refund ambiguity retains resolution-required handling and never automatically retries",async()=>{
  let uncertain=0;let failed=0;let calls=0;
  const local=new OperationsService({...repository,reserveRefund:async()=>({outcome:"reserved",refundId:"r1",paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:50,refundableMinor:1000}),markRefundResolutionRequired:async()=>{uncertain++;},failRefund:async()=>{failed++;}},{getConfiguredProvider:()=>provider,getProvider:()=>({...provider,refund:async()=>{calls++;throw new PaymentProviderError("network_error","Safe failure",true);}})});
  await assert.rejects(()=>local.refundReturn({orderId:returnOrderId,returnId,expectedVersion:2,operatorId:"operator",idempotencyKey:"ambiguous-return"}),OperationsError);
  assert.equal(uncertain,2);assert.equal(failed,0);assert.equal(calls,1);
});
test("return reservation conflicts/not-found remain safe API responses without contacting providers",async()=>{
  for(const code of ["conflict","not_found"] as const){
    let lookups=0;
    const local=new OperationsService({...repository,reserveRefund:async()=>{throw new OperationsError(code,code==='conflict'?'Return is not eligible for its approved refund. Reload and review.':'Return was not found for this order.');}},{getConfiguredProvider:()=>provider,getProvider:()=>{lookups++;return provider;}});
    const response=await handleOperationsRequest(new Request(`https://ops.test/operations/orders/${returnOrderId}/returns/${returnId}/refund`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":"conflict-test"},body:JSON.stringify({expectedVersion:2})}),local,{id:"operator",permissions:["returns:approve","refunds:create"]});
    assert.equal(response.status,code==='conflict'?409:404);assert.equal(lookups,0);assert.equal((await response.json() as {code:string}).code,code);
  }
});

test("operations handler rejects unauthenticated and unauthorised callers",async()=>{
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service)).status,401);
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service,{id:"viewer",permissions:[]})).status,403);
});

test("operations handler rejects malformed trusted-principal input",async()=>{
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service,{id:" ",permissions:["orders:read"]})).status,401);
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service,{id:"operator",permissions:["orders:read","orders:read"]})).status,401);
  const forged={id:"operator",permissions:["orders:read","admin:all"]} as unknown as Parameters<typeof handleOperationsRequest>[2];
  assert.equal((await handleOperationsRequest(new Request("https://ops.test/operations/orders"),service,forged)).status,401);
});

test("permission-controlled refund uses provider contract",async()=>{
  const response=await handleOperationsRequest(new Request("https://ops.test/operations/orders/o1/refunds",{method:"POST",headers:{"content-type":"application/json","idempotency-key":"refund-1"},body:JSON.stringify({amountMinor:500,reason:"customer_request"})}),service,{id:"operator@example.test",permissions:["refunds:create"]});
  assert.equal(response.status,201); assert.equal(state.completed,"re_1");
});

test("reconciliation requires bounded dates and escapes spreadsheet formulae",async()=>{
  const rows={...repository,reconciliationRows:async()=>[{
    order_number:"=unsafe",order_created_at:"2026-01-01",order_status:"paid",
    customer_name:"Private Customer",customer_email:"private@example.test",
    delivery_address:"1 Private Street",access_assertion:"secret-access-assertion",
    payment_credential:"secret-payment-credential",raw_provider_payload:"secret-provider-payload",
  }]};
  const local=new OperationsService(rows,{getConfiguredProvider:()=>provider,getProvider:()=>provider});
  const response=await handleOperationsRequest(new Request("https://ops.test/operations/reconciliation.csv?from=2026-01-01&to=2026-01-02"),local,{id:"finance",permissions:["reconciliation:export"]});
  assert.equal(response.status,200); const body=await response.text(); assert.match(body,/"'=unsafe"/);
  assert.match(body,/"checkout_state"/); assert.match(body,/"resolution_required_refund_minor"/);
  assert.equal(body.split("\r\n")[0],reconciliationCsvColumns.map((column)=>`"${column}"`).join(","));
  assert.doesNotMatch(body,/Private Customer|private@example\.test|Private Street|secret-access|secret-payment|secret-provider/);
  assert.equal(response.headers.get("X-Frame-Options"),"DENY");
  assert.equal(response.headers.get("Referrer-Policy"),"no-referrer");
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
  assert.equal(resolutionRequired,2);
  assert.equal(failed,0);
});

test("retryable refund failure keeps the amount reserved and blocks a replacement refund",async()=>{
  let reservedMinor=0; let resolutionRequired=false; let providerRefundCalls=0;
  const ambiguousProvider:PaymentProvider={
    ...provider,
    refund:async()=>{providerRefundCalls+=1;throw new PaymentProviderError("provider_unavailable","temporary provider failure",true);},
  };
  const reservationRepository:OperationsRepository={
    ...repository,
    reserveRefund:async(input)=>{
      const available=1000-reservedMinor;
      if((input.amountMinor??0)>available) throw new OperationsError("conflict","Refund amount exceeds the unreserved payment balance.");
      reservedMinor+=(input.amountMinor??0);
      return {outcome:"reserved" as const,refundId:"r-ambiguous",paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:(input.amountMinor??0),refundableMinor:available};
    },
    markRefundResolutionRequired:async()=>{resolutionRequired=true;},
  };
  const ambiguousService=new OperationsService(reservationRepository,{getConfiguredProvider:()=>ambiguousProvider,getProvider:()=>ambiguousProvider});
  await assert.rejects(()=>ambiguousService.refund({orderId:"o1",amountMinor:700,reason:"customer_request",operatorId:"operator",idempotencyKey:"refund-ambiguous"}),/could not complete/);
  assert.equal(resolutionRequired,true);
  assert.equal(reservedMinor,700);
  await assert.rejects(()=>ambiguousService.refund({orderId:"o1",amountMinor:400,reason:"operator_correction",operatorId:"operator",idempotencyKey:"refund-replacement"}),/unreserved payment balance/);
  assert.equal(providerRefundCalls,1);
  assert.equal(reservedMinor,700);
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
    reserveRefund:async(input)=>({outcome:"reserved" as const,refundId:`r${amounts.length+1}`,paymentId:"p1",provider:"mollie-test",providerPaymentId:"tr_1",currency:"GBP",amountMinor:(input.amountMinor??0),refundableMinor:1000}),
  };
  const amountService=new OperationsService(amountRepository,{getConfiguredProvider:()=>amountProvider,getProvider:()=>amountProvider});
  await amountService.refund({orderId:"o1",amountMinor:400,reason:"customer_request",operatorId:"operator",idempotencyKey:"partial"});
  await amountService.refund({orderId:"o1",amountMinor:1000,reason:"cancelled_order",operatorId:"operator",idempotencyKey:"full"});
  assert.deepEqual(amounts,[400,1000]);
});

test("refund diagnostic records retryable submit failure safely before resolution marking", async (t) => {
  const logs: string[] = []; let resolved = 0; let failed = 0; let calls = 0; let correlationId = "";
  t.mock.method(console, "error", (entry: string) => { logs.push(entry); });
  const failingProvider: PaymentProvider = { ...provider, refund: async (input) => {
    calls++; correlationId = input.correlationId;
    throw Object.assign(new PaymentProviderError("conflict", "Authorization: Bearer secret-key; customer@example.test; raw-provider-body", true), {
      response: { body: "raw-provider-body" }, headers: { Authorization: "secret-key" }, customer: "customer@example.test",
    });
  } };
  const failingRepository: OperationsRepository = { ...repository,
    markRefundResolutionRequired: async () => { assert.equal(logs.length, resolved === 0 ? 0 : 1); resolved++; },
    failRefund: async () => { failed++; },
  };
  const local = new OperationsService(failingRepository, { getProvider: () => failingProvider, getConfiguredProvider: () => failingProvider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 500, reason: "customer_request", operatorId: "operator", idempotencyKey: "diagnostic-refund" }), /could not complete/);
  assert.equal(resolved, 2); assert.equal(failed, 0); assert.equal(calls, 1);
  const diagnostic = JSON.parse(logs[0]!);
  assert.ok(Number.isFinite(Date.parse(diagnostic.timestamp)));
  assert.deepEqual({ ...diagnostic, timestamp: "verified" }, { timestamp: "verified", level: "error", event: "refund_provider_error", stage: "submit_refund", provider: "mollie-test", refundId: "r1", correlationId,
    error: { name: "PaymentProviderError", message: "Refund operation failed.", category: "conflict", retryable: true } });
  assert.doesNotMatch(logs.join(""), /secret-key|Authorization|customer@example|raw-provider-body|diagnostic-refund/);
});

test("refund diagnostic identifies lookup, payment, balance and persistence failure stages", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "error", (entry: string) => { logs.push(entry); });
  for (const stage of ["provider_lookup", "get_payment", "validate_refundable_balance", "persist_provider_result"]) {
    const fail = async (): Promise<never> => { throw new Error("private-provider-data"); };
    const localProvider: PaymentProvider = { ...provider, getPayment: stage === "get_payment" ? fail : async () => ({ ...await provider.getPayment({ providerPaymentId: "tr_1", correlationId: "test" }), refundableAmount: money(stage === "validate_refundable_balance" ? 0 : 1000, "GBP") }) };
    const local = new OperationsService({ ...repository, completeRefund: stage === "persist_provider_result" ? fail : repository.completeRefund }, {
      getProvider: () => { if (stage === "provider_lookup") throw new Error("private-provider-data"); return localProvider; }, getConfiguredProvider: () => localProvider,
    });
    await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 500, reason: "customer_request", operatorId: "operator", idempotencyKey: "diagnostic-stages" }));
    assert.equal(JSON.parse(logs.at(-1)!).stage, stage);
  }
  assert.equal(logs.length, 4); assert.doesNotMatch(logs.join(""), /private-provider-data/);
});

test("refund diagnostic routes safe Mollie 409 metadata and preserves resolution handling", async (t) => {
  const logs: string[] = []; let resolved = 0; let calls = 0;
  t.mock.method(console, "error", (entry: string) => { logs.push(entry); });
  const mollie = new MollieTestPaymentProvider({ apiKey: "test_example_key", allowedCallbackOrigins: ["https://checkout.cyph1.co.uk"], fetch: async () => {
    calls++;
    return new Response(JSON.stringify({ status: 409, title: "Conflict", field: "amount", detail: "Authorization: Bearer test_example_key customer@example.test", metadata: "private", arbitrary: "raw-body" }), { status: 409, headers: { "content-type": "application/hal+json" } });
  } });
  const localProvider: PaymentProvider = { ...provider, refund: (input) => mollie.refund(input) };
  const local = new OperationsService({ ...repository, markRefundResolutionRequired: async () => { assert.equal(logs.length, resolved === 0 ? 0 : 1); resolved++; },
    failRefund: async () => { assert.fail("must remain resolution_required"); }, completeRefund: async () => { assert.fail("must not complete"); } },
    { getProvider: () => localProvider, getConfiguredProvider: () => localProvider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 500, reason: "customer_request", operatorId: "operator", idempotencyKey: "diagnostic-mollie" }), /could not complete/);
  assert.equal(resolved, 2); assert.equal(calls, 1);
  const diagnostic = JSON.parse(logs[0]!);
  assert.equal(diagnostic.event, "refund_provider_error"); assert.equal(diagnostic.stage, "submit_refund");
  assert.deepEqual(diagnostic.error, { name: "PaymentProviderError", message: "Refund operation failed.", category: "conflict", retryable: true, providerDiagnostic: { status: 409, title: "Conflict", field: "amount" } });
  assert.doesNotMatch(logs.join(""), /Authorization|test_example_key|customer@example|metadata|private|arbitrary|raw-body/);
});

test("refund diagnostic delivery failure does not change resolution handling", async (t) => {
  t.mock.method(console, "error", () => { throw new Error("logger unavailable"); });
  let resolved = 0;
  const localProvider: PaymentProvider = { ...provider, refund: async () => { throw new PaymentProviderError("conflict", "conflict", true, { status: 409, title: "Conflict", field: "amount" }); } };
  const local = new OperationsService({ ...repository, markRefundResolutionRequired: async () => { resolved++; } }, { getProvider: () => localProvider, getConfiguredProvider: () => localProvider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 500, reason: "customer_request", operatorId: "operator", idempotencyKey: "diagnostic-logger" }), /could not complete/);
  assert.equal(resolved, 2);
});

test("refund success is fenced before provider submission and then completed normally", async () => {
  const sequence: string[] = [];
  const local = new OperationsService({ ...repository,
    markRefundResolutionRequired: async () => { sequence.push("fence"); },
    completeRefund: async () => { sequence.push("complete"); },
    failRefund: async () => { assert.fail("must not fail"); },
  }, { getProvider: () => ({ ...provider, refund: async input => { sequence.push("provider"); return provider.refund(input); } }), getConfiguredProvider: () => provider });
  await local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "success-fence" });
  assert.deepEqual(sequence, ["fence", "provider", "complete"]);
});

test("refund persistence failure retains known provider ID and never calls definitive failure", async () => {
  const references: (string | undefined)[] = []; let submitted = 0;
  const local = new OperationsService({ ...repository,
    markRefundResolutionRequired: async input => { references.push(input.providerRefundId); },
    completeRefund: async () => { throw new Error("synthetic database failure"); },
    failRefund: async () => { assert.fail("accepted refund must remain uncertain"); },
  }, { getProvider: () => ({ ...provider, refund: async input => { submitted++; return { ...await provider.refund(input), providerRefundId: "re_known" }; } }), getConfiguredProvider: () => provider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "persist-failure" }), OperationsError);
  assert.equal(submitted, 1); assert.deepEqual(references, [undefined, "re_known"]);
});

test("only definite rejection releases a submitted refund; unclassified and malformed responses remain uncertain", async () => {
  for (const failure of [new PaymentProviderError("validation_error", "Rejected"), new Error("connection dropped"), new PaymentProviderError("unknown_provider_error", "Malformed response")]) {
    let marked = 0; let failed = 0;
    const local = new OperationsService({ ...repository,
      markRefundResolutionRequired: async () => { marked++; }, failRefund: async () => { failed++; },
    }, { getProvider: () => ({ ...provider, refund: async () => { throw failure; } }), getConfiguredProvider: () => provider });
    await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "submission-error" }), OperationsError);
    const rejected = failure instanceof PaymentProviderError && failure.category === "validation_error";
    assert.equal(marked, rejected ? 1 : 2); assert.equal(failed, rejected ? 1 : 0);
  }
});

test("failure before submission cannot contact the provider and may release its reservation", async () => {
  let submitted = 0; let failed = 0; let marked = 0;
  const local = new OperationsService({ ...repository,
    failRefund: async () => { failed++; }, markRefundResolutionRequired: async () => { marked++; },
  }, { getProvider: () => ({ ...provider, getPayment: async () => { throw new Error("lookup failure"); }, refund: async input => { submitted++; return provider.refund(input); } }), getConfiguredProvider: () => provider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "lookup-error" }), OperationsError);
  assert.equal(submitted, 0); assert.equal(failed, 1); assert.equal(marked, 0);
});

test("failure to persist submission fence prevents provider contact", async () => {
  let submitted = 0;
  const local = new OperationsService({ ...repository, markRefundResolutionRequired: async () => { throw new Error("fence unavailable"); } }, {
    getProvider: () => ({ ...provider, refund: async input => { submitted++; return provider.refund(input); } }), getConfiguredProvider: () => provider,
  });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "fence-error" }), OperationsError);
  assert.equal(submitted, 0);
});

test("fallback persistence outage preserves the fence and exposes only safe diagnostics", async (t) => {
  const logs: string[] = []; let marked = 0; let failed = 0;
  t.mock.method(console, "error", (entry: string) => { logs.push(entry); });
  const local = new OperationsService({ ...repository,
    markRefundResolutionRequired: async () => { if (++marked > 1) throw new Error("Authorization: secret customer@example.test"); },
    completeRefund: async () => { throw new Error("private database details"); },
    failRefund: async () => { failed++; },
  }, { getProvider: () => provider, getConfiguredProvider: () => provider });
  await assert.rejects(() => local.refund({ orderId: "o1", amountMinor: 50, reason: "customer_request", operatorId: "operator", idempotencyKey: "fallback-outage" }),
    error => error instanceof OperationsError && error.message === "The refund outcome requires reconciliation.");
  assert.equal(marked, 2); assert.equal(failed, 0);
  assert.deepEqual(logs.map(entry => JSON.parse(entry).stage), ["persist_provider_result", "persist_failure_state"]);
  assert.doesNotMatch(logs.join(""), /Authorization|secret|customer@example|private database/);
});
