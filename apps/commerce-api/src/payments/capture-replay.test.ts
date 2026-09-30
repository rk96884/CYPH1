import assert from "node:assert/strict";
import test from "node:test";
import { money, type CaptureInput } from "../../../../packages/commerce-core/src/index.js";
import { MollieTestPaymentProvider } from "./mollie-test.js";
import { MollieLivePaymentProvider } from "./mollie-live.js";
import { mollieCaptureContext, mollieCaptureReplaySafe } from "./mollie-capture-replay.js";
const now=new Date('2026-09-29T12:00:00Z');
const raw={id:'cpt_1',paymentId:'tr_1',status:'succeeded',amount:{value:'10.00',currency:'GBP'},createdAt:now.toISOString()};
const response=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
for(const live of [false,true]) {
  test(`${live?'live':'test'} adapter lists captures and preserves original replay key and wire body`,async()=>{
    const requests:{url:string;init:RequestInit|undefined}[]=[];
    const config={apiKey:live?'live_example_key':'test_example_key',allowedCallbackOrigins:['https://checkout.example.test'],clock:()=>now,fetch:async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
      requests.push({url:String(url),init});
      return response(init?.method==='POST'?raw:{count:1,_embedded:{captures:[{...raw,customer:{email:'private@example.test'}}]},_links:{next:null}});
    }};
    const provider=live?new MollieLivePaymentProvider(config):new MollieTestPaymentProvider(config);
    const list=await provider.listCaptures({providerPaymentId:'tr_1',correlationId:'recovery'});
    assert.equal(list.complete,true);assert.equal(list.captures[0]?.provider,live?'mollie-live':'mollie-test');assert.equal(list.captures[0]?.status,'completed');assert.doesNotMatch(JSON.stringify(list),/private@example/);
    const original:CaptureInput={orderId:'o1',paymentId:'p1',providerPaymentId:'tr_1',amount:money(1000,'GBP'),authorisedAmount:money(1000,'GBP'),operatorId:'original-operator',idempotencyKey:'original-key',correlationId:'original-correlation'};
    await provider.capture(original);
    await provider.capture({...original,correlationId:'recovery',replay:{firstAttemptAt:'2026-09-29T11:50:00Z',providerContext:provider.captureReplayContext()}});
    assert.equal(requests[0]?.url,'https://api.mollie.com/v2/payments/tr_1/captures?limit=250');
    assert.equal(requests[1]?.init?.body,requests[2]?.init?.body);
    assert.equal(new Headers(requests[2]?.init?.headers).get('Idempotency-Key'),'original-key');
    assert.equal(new Headers(requests[2]?.init?.headers).get('Authorization'),`Bearer ${config.apiKey}`);
    await assert.rejects(()=>provider.capture({...original,replay:{firstAttemptAt:'2026-09-29T11:00:00Z',providerContext:provider.captureReplayContext()}}),/not demonstrably safe/);
    await assert.rejects(()=>provider.capture({...original,replay:{firstAttemptAt:'2026-09-29T11:50:00Z',providerContext:mollieCaptureContext('different-credential')}}),/not demonstrably safe/);
    assert.equal(requests.length,3);
  });
}
test('replay guarantee is bounded, credential and wire-version scoped',()=>{
  const context=mollieCaptureContext('test_secret');
  assert.doesNotMatch(context,/test_secret/);
  for(const firstAttemptAt of ['invalid','2026-09-29T12:00:01Z','2026-09-29T11:05:00Z','2026-09-29T11:00:00Z'])assert.equal(mollieCaptureReplaySafe({firstAttemptAt,providerContext:context},context,now),false);
  assert.equal(mollieCaptureReplaySafe({firstAttemptAt:'2026-09-29T11:05:01Z',providerContext:context},context,now),true);
  assert.notEqual(context,mollieCaptureContext('test_secret','https://other.example/v2'));
});
test('truncated list is never evidence of no captures; malformed identity/status/date fail closed',async()=>{
  let body:unknown={count:0,_embedded:{captures:[]},_links:{next:{href:'https://api.mollie.com/next'}}};
  const provider=new MollieTestPaymentProvider({apiKey:'test_example_key',allowedCallbackOrigins:['https://checkout.example.test'],fetch:async()=>response(body)});
  assert.equal((await provider.listCaptures({providerPaymentId:'tr_1',correlationId:'corr'})).complete,false);
  for(const item of [{...raw,paymentId:'tr_other'},{...raw,status:'unknown'},{...raw,createdAt:'bad'}]){
    body={count:1,_embedded:{captures:[item]},_links:{next:null}};
    await assert.rejects(()=>provider.listCaptures({providerPaymentId:'tr_1',correlationId:'corr'}));
  }
  body={count:0,_embedded:{captures:[]}};
  await assert.rejects(()=>provider.listCaptures({providerPaymentId:'tr_1',correlationId:'corr'}));
});
