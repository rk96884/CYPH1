import test from "node:test";
import assert from "node:assert/strict";
import { renderTransactionalMessage } from "./templates.js";
import { ManualTestCommunicationProvider } from "./manual-test.js";
import { TransactionalCommunicationConsumer } from "./service.js";
import { PostgresCommunicationRepository } from "./postgres.js";

const context={deliveryId:"d1",claimToken:"claim-1",template:"order-confirmation" as const,deduplicationKey:"order-confirmation:o1",recipient:"buyer@example.test",orderNumber:"CYPH-1",currency:"GBP",totalMinor:1299};

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
  assert.match(order.html,/ORDER CONFIRMED/);
  assert.match(order.html,/5 October 2026/);
  assert.match(order.html,/Standard UK Delivery/);
  assert.match(order.html,/Total amount paid/);
  assert.match(order.html,/Company number 17455968/);

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

test("dispatch links only to an explicitly supplied safe tracking URL",()=>{
  const dispatch={...context,template:"dispatch" as const,trackingCarrier:"Carrier & Co",trackingReference:"REF<1>",expectedDelivery:"2–3 days <estimate>"};
  const message=renderTransactionalMessage({...dispatch,trackingUrl:"https://carrier.example/track?ref=123&lang=en"});
  assert.match(message.html,/href="https:\/\/carrier\.example\/track\?ref=123&amp;lang=en"/);
  assert.match(message.html,/>Track your delivery<\/a>/);
  assert.match(message.html,/Carrier: <strong>Carrier &amp; Co/);
  assert.match(message.html,/Tracking number: <strong>REF&lt;1&gt;/);
  assert.match(message.html,/Expected delivery: 2–3 days &lt;estimate&gt;/);
  assert.match(message.text,/Track your delivery: https:\/\/carrier\.example\/track\?ref=123&lang=en/);
  for(const trackingUrl of [undefined,"","not a URL","/track/123","javascript:alert(1)","data:text/html,unsafe","https://user:password@carrier.example/","https://carrier.example/\nunsafe","https://tracking-placeholder.invalid/PREVIEW-ONLY"]){
    const fallback=renderTransactionalMessage({...dispatch,...(trackingUrl === undefined?{}:{trackingUrl})});
    assert.doesNotMatch(fallback.html,/Track your delivery|tracking-placeholder\.invalid/);
    assert.doesNotMatch(fallback.text,/Track your delivery/);
    assert.match(fallback.html,/REF&lt;1&gt;/);
    assert.match(fallback.html,/Carrier &amp; Co/);
  }
  assert.doesNotMatch(renderTransactionalMessage({...context,trackingUrl:"https://carrier.example/track"}).html,/Track your delivery/);
});

test("placeholder tracking CTA is restricted to explicit isolated previews",()=>{
  const preview={...context,template:"dispatch" as const,recipient:"preview@example.test",deduplicationKey:"preview:dispatch",trackingUrl:"https://tracking-placeholder.invalid/PREVIEW-ONLY"};
  assert.doesNotMatch(renderTransactionalMessage(preview).html,/Track your delivery/);
  const message=renderTransactionalMessage(preview,{preview:true});
  assert.match(message.html,/Track your delivery/);
  assert.match(message.html,/PREVIEW ONLY — placeholder tracking URL/);
  assert.doesNotMatch(renderTransactionalMessage({...preview,recipient:"buyer@example.test"},{preview:true}).html,/Track your delivery/);
  assert.doesNotMatch(renderTransactionalMessage({...preview,deduplicationKey:"dispatch:f1"},{preview:true}).html,/Track your delivery/);
});

test("confirmation uses escaped order rows, free delivery and the actual total once",()=>{
  const message=renderTransactionalMessage({...context,orderNumber:"A&B",orderPlacedAt:"2026-10-05T12:00:00Z",items:[
    {name:"Device <one>",quantity:2,lineTotalMinor:1000},
    {name:"Accessory & case",quantity:1,lineTotalMinor:299},
  ],deliveryMethod:"Delivery <express>",deliveryMinor:0,expectedDelivery:"2–3 days <estimate>"});
  assert.match(message.html,/placed on 5 October 2026/);
  assert.match(message.html,/Device &lt;one&gt;/);
  assert.match(message.html,/Accessory &amp; case/);
  assert.match(message.html,/Delivery &lt;express&gt;/);
  assert.match(message.html,/£0\.00/);
  assert.match(message.html,/Expected delivery: 2–3 days &lt;estimate&gt;/);
  assert.equal(message.html.match(/£12\.99/g)?.length,1);
  assert.equal(message.html.match(/5 October 2026/g)?.length,1);
  assert.doesNotMatch(message.html,/Order placed:|Delivery charge:|Amount paid:|£299\.00/);
  assert.match(message.text,/Device <one> \| 2 \| £10\.00/);
  assert.match(message.text,/A&B/);
  assert.match(message.text,/Total amount paid \| £12\.99/);
});

test("shared branding uses the approved logo and six linked social icons",()=>{
  for(const template of ["order-confirmation","dispatch","cancellation","refund"] as const){
    const message=renderTransactionalMessage({...context,template});
    assert.match(message.html,/brand\/email\/cyph1-lockup\.png/);
    for(const name of ["instagram","tiktok","facebook","linkedin","youtube","x"]){
      assert.ok(message.html.includes(`/brand/email/${name}.png`));
    }
  }
});

test("paid delivery is a table row and the saved total is never recomputed",()=>{
  const message=renderTransactionalMessage({...context,totalMinor:1500,items:[{name:"Device",quantity:1,lineTotalMinor:1000}],deliveryMethod:"Express UK Delivery",deliveryMinor:500});
  assert.match(message.text,/Express UK Delivery \| 1 \| £5\.00/);
  assert.match(message.text,/Total amount paid \| £15\.00/);
  assert.doesNotMatch(message.text,/placed on|Expected delivery/);
});

test("new and retried communications load the saved order-item snapshots",async()=>{
  for(const retry of [false,true]){
    const row={delivery_id:"d1",order_id:"o1",customer_id:"c1",source_event_id:"e1",event_type:"payment.paid",template_key:"order-confirmation",deduplication_key:"order-confirmation:o1",order_number:"CYPH-1",currency:"GBP",total_minor:"1500",delivery_minor:"500",created_at:"2026-10-05T12:00:00Z",shipping_method_snapshot:{name:"Express UK Delivery"},email_display:"buyer@example.test",refund_minor:null,tracking_url:"https://carrier.example/track/123"};
    const client={
      query:async(sql:string,values?:unknown[])=>{
        if(sql.includes("FROM order_items")){
          assert.deepEqual(values,["o1"]);
          return {rowCount:2,rows:[{name_snapshot:"Device",quantity:1,line_total_minor:"700"},{name_snapshot:"Accessory",quantity:2,line_total_minor:"300"}]};
        }
        if(sql.includes("SELECT d.id"))return {rowCount:retry?1:0,rows:retry?[row]:[]};
        if(sql.includes("SELECT e.id"))return {rowCount:1,rows:[row]};
        if(sql.includes("INSERT INTO communication_deliveries"))return {rowCount:1,rows:[{id:"d1"}]};
        return {rowCount:0,rows:[]};
      },release:()=>{},
    };
    // Minimal database test double; the production repository retains pg's query typing.
    const pool={connect:async()=>client} as unknown as ConstructorParameters<typeof PostgresCommunicationRepository>[0];
    const delivery=await new PostgresCommunicationRepository(pool).claimNext();
    assert.deepEqual(delivery?.items,[{name:"Device",quantity:1,lineTotalMinor:700},{name:"Accessory",quantity:2,lineTotalMinor:300}]);
    assert.equal(delivery?.totalMinor,1500);
    assert.equal(delivery?.deliveryMinor,500);
    assert.equal(delivery?.deliveryMethod,"Express UK Delivery");
    assert.equal(delivery?.trackingUrl,"https://carrier.example/track/123");
  }
});

test("message idempotency key is semantic and stable",()=>{
  const first=renderTransactionalMessage(context);
  const second=renderTransactionalMessage({...context,recipient:"other@example.test"});
  assert.equal(first.idempotencyKey,"communication:order-confirmation:o1");
  assert.equal(first.idempotencyKey,second.idempotencyKey);
});

test("consumer is disabled by default and does not claim",async()=>{
  let claimed=false;
  const repository={claimNext:async()=>{claimed=true;return context},beginSend:async()=>{},markReview:async()=>{},markSent:async()=>{},markFailed:async()=>{}};
  const result=await new TransactionalCommunicationConsumer(false,repository,new ManualTestCommunicationProvider()).consumeOne();
  assert.equal(result.outcome,"disabled");
  assert.equal(claimed,false);
});

test("consumer sends and records one claimed delivery",async()=>{
  let sent="";
  const repository={claimNext:async()=>context,beginSend:async()=>{},markReview:async()=>{},markSent:async(_id:string,_provider:string,reference:string)=>{sent=reference},markFailed:async()=>{}};
  const result=await new TransactionalCommunicationConsumer(true,repository,new ManualTestCommunicationProvider()).consumeOne();
  assert.equal(result.outcome,"sent");
  assert.match(sent,/^manual-/);
});

test("consumer routes unknown provider failure to review without marking sent",async()=>{
  let failed=""; let sent=false;
  const provider={key:"failing",send:async()=>{throw new TypeError("provider unavailable")}};
  const repository={claimNext:async()=>context,beginSend:async()=>{},markReview:async()=>{},markSent:async()=>{sent=true},markFailed:async(_id:string,error:string)=>{failed=error}};
  const result=await new TransactionalCommunicationConsumer(true,repository,provider).consumeOne();
  assert.equal(result.outcome,"manual_review");
  assert.equal(sent,false);
  assert.equal(failed,"");
  assert.equal(result.outcome,"manual_review");
});

test("communication retries and claim leases have bounded configuration",()=>{
  const pool={} as ConstructorParameters<typeof PostgresCommunicationRepository>[0];
  assert.doesNotThrow(()=>new PostgresCommunicationRepository(pool,3,300));
  assert.throws(()=>new PostgresCommunicationRepository(pool,0,300),/between 1 and 10/);
  assert.throws(()=>new PostgresCommunicationRepository(pool,3,29),/between 30 and 3600/);
});
