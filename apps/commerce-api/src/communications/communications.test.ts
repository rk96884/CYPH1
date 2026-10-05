import test from "node:test";
import assert from "node:assert/strict";
import { renderTransactionalMessage } from "./templates.js";
import { ManualTestCommunicationProvider } from "./manual-test.js";
import { TransactionalCommunicationConsumer } from "./service.js";
import { PostgresCommunicationRepository } from "./postgres.js";

const context={deliveryId:"d1",template:"order-confirmation" as const,deduplicationKey:"order-confirmation:o1",recipient:"buyer@example.test",orderNumber:"CYPH-1",currency:"GBP",totalMinor:1299};

test("renders escaped, clearly transactional order confirmation",()=>{
  const message=renderTransactionalMessage({...context,orderNumber:"<order>"});
  assert.match(message.html,/&lt;order&gt;/);
  assert.doesNotMatch(message.html,/<order>/);
  assert.match(message.text,/transactional message/i);
  assert.doesNotMatch(message.text,/unsubscribe/i);
});

test("renders the four approved transactional templates",()=>{
  const order=renderTransactionalMessage({...context,orderPlacedAt:"2026-10-05T12:00:00.000Z",deliveryMethod:"Standard UK Delivery",deliveryMinor:0,expectedDelivery:"2–3 working days"});
  assert.equal(order.subject,"CYPH/1 order CYPH-1 confirmed");
  assert.match(order.text,/£12\.99/);
  assert.match(order.html,/ORDER CONFIRMED/);\n  assert.match(order.html,/5 October 2026/);\n  assert.match(order.html,/Standard UK Delivery/);\n  assert.match(order.html,/Amount paid/);\n  assert.match(order.html,/Warranty &amp; Returns/);\n  assert.match(order.html,/Company number 17455968/);

  const dispatch=renderTransactionalMessage({...context,template:"dispatch",deduplicationKey:"dispatch:f1",trackingCarrier:"Carrier & Co",trackingReference:"TRACK<1>"});
  assert.match(dispatch.subject,/dispatched/);
  assert.match(dispatch.html,/TRACK&lt;1&gt;/);
  assert.match(dispatch.html,/Carrier &amp; Co/);

  const cancellation=renderTransactionalMessage({...context,template:"cancellation",deduplicationKey:"cancellation:o1"});
  assert.match(cancellation.subject,/cancelled/);
  assert.match(cancellation.text,/refund will be confirmed separately/i);

  const refund=renderTransactionalMessage({...context,template:"refund",deduplicationKey:"refund:r1",refundMinor:725});
  assert.match(refund.subject,/Refund confirmed/);
  assert.match(refund.text,/£7\.25/);
  assert.match(refund.text,/payment provider may take additional time/i);
});

test("dispatch remains truthful when tracking is unavailable",()=>{
  const message=renderTransactionalMessage({...context,template:"dispatch",deduplicationKey:"dispatch:f2"});
  assert.match(message.text,/has been dispatched/);
  assert.doesNotMatch(message.text,/Tracking reference/);
});

test("message idempotency key is semantic and stable",()=>{
  const first=renderTransactionalMessage(context);
  const second=renderTransactionalMessage({...context,recipient:"other@example.test"});
  assert.equal(first.idempotencyKey,"communication:order-confirmation:o1");
  assert.equal(first.idempotencyKey,second.idempotencyKey);
});

test("consumer is disabled by default and does not claim",async()=>{
  let claimed=false;
  const repository={claimNext:async()=>{claimed=true;return context},markSent:async()=>{},markFailed:async()=>{}};
  const result=await new TransactionalCommunicationConsumer(false,repository,new ManualTestCommunicationProvider()).consumeOne();
  assert.equal(result.outcome,"disabled");
  assert.equal(claimed,false);
});

test("consumer sends and records one claimed delivery",async()=>{
  let sent="";
  const repository={claimNext:async()=>context,markSent:async(_id:string,_provider:string,reference:string)=>{sent=reference},markFailed:async()=>{}};
  const result=await new TransactionalCommunicationConsumer(true,repository,new ManualTestCommunicationProvider()).consumeOne();
  assert.equal(result.outcome,"sent");
  assert.match(sent,/^manual-/);
});

test("consumer records provider failure without marking sent",async()=>{
  let failed=""; let sent=false;
  const provider={key:"failing",send:async()=>{throw new TypeError("provider unavailable")}};
  const repository={claimNext:async()=>context,markSent:async()=>{sent=true},markFailed:async(_id:string,error:string)=>{failed=error}};
  const result=await new TransactionalCommunicationConsumer(true,repository,provider).consumeOne();
  assert.equal(result.outcome,"failed");
  assert.equal(sent,false);
  assert.equal(failed,"TypeError");
});

test("communication retries and claim leases have bounded configuration",()=>{
  const pool={} as ConstructorParameters<typeof PostgresCommunicationRepository>[0];
  assert.doesNotThrow(()=>new PostgresCommunicationRepository(pool,3,300));
  assert.throws(()=>new PostgresCommunicationRepository(pool,0,300),/between 1 and 10/);
  assert.throws(()=>new PostgresCommunicationRepository(pool,3,29),/between 30 and 3600/);
});
