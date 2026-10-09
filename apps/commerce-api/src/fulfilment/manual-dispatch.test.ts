import { shippingRateRevision } from "../checkout/service.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { fulfilmentAddress, manualDispatchCommand, trackingHttpsUrl, ManualDispatchError, type PackingInformation } from "./manual-dispatch.js";
import { FulfilmentService } from "./service.js";
import { PostgresFulfilmentRepository } from "./postgres.js";
import { ManualTestFulfilmentProvider } from "./manual-test.js";
import { PostgresCheckoutRepository } from "../checkout/postgres.js";
import { handleOperationsRequest } from "../operations/handler.js";
import { createProtectedOperationsHandler } from "../access/protected-operations.js";
import { OperationsService, type OperationsRepository } from "../operations/service.js";
import { PostgresCommunicationRepository } from "../communications/postgres.js";
import { TransactionalCommunicationConsumer } from "../communications/service.js";
import { handleOrderStatusRequest, PostgresOrderStatusRepository } from "../checkout/status.js";
import type { PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";
const orderId = randomUUID(), fulfilmentId = randomUUID();
const body = { fulfilmentId, carrier: "Royal Mail", service: "Tracked 48", trackingReference: "SYNTHETIC-123", trackingUrl: "https://www.royalmail.com/track-your-item#/tracking-results/SYNTHETIC-123", handoverConfirmed: true };
const ops = new OperationsService({} as OperationsRepository, {} as PaymentProviderRegistry);
const invalid = (error: unknown) => error instanceof ManualDispatchError && error.code === "invalid_request";
test("checkout name fields take precedence while historical recipient snapshots remain supported", () => {
  assert.equal(fulfilmentAddress({givenName:" Synthetic ",familyName:" Customer ",recipientName:"Stale"}).recipientName,"Synthetic Customer");
  assert.equal(fulfilmentAddress({recipientName:"Historical Customer"}).recipientName,"Historical Customer");
});
test("manual dispatch accepts carrier-neutral values and optional URL without inference", () => {
  for (const [carrier,service] of [["Royal Mail","Tracked 48"],["Evri","Standard"],["DPD","Economy"],["InPost","Home Delivery"]]) {
    const value=manualDispatchCommand(orderId,{...body,carrier,service,trackingUrl:""},"named-operator","key-1");
    assert.equal(value.carrier,carrier); assert.equal(value.service,service); assert.equal(value.trackingUrl,undefined); assert.equal(value.operatorId,"named-operator");
  }
});
test("dispatch requires explicit boolean handover, valid fields and command identities", () => {
  for (const change of [{handoverConfirmed:false},{handoverConfirmed:"true"},{carrier:" "},{service:"x".repeat(101)},{trackingReference:"bad\nref"},{fulfilmentId:"bad"},{operatorId:"forged"}]) assert.throws(()=>manualDispatchCommand(orderId,{...body,...change},"operator","key"),invalid);
  assert.throws(()=>manualDispatchCommand("bad",body,"operator","key"),invalid);
  assert.throws(()=>manualDispatchCommand(orderId,body,"operator",""),invalid);
});
test("tracking validation rejects malformed, non-HTTPS, credential and local destinations", () => {
  for (const value of ["http://carrier.example/track","javascript:alert(1)","//carrier.example/track","https://user:pass@carrier.example/","https://localhost/","https://127.0.0.1/","https://[::1]/","https://carrier.invalid/","https://carrier.example:8443/","https://carrier.example/a b","https://carrier.example/%0a","https://","https:\\carrier.example","not-a-url",42,null]) assert.throws(()=>trackingHttpsUrl(value),invalid);
  assert.equal(trackingHttpsUrl(body.trackingUrl),body.trackingUrl);
  assert.equal(trackingHttpsUrl(undefined),undefined);
});
test("fingerprint binds order, shipment details and authenticated operator; retries are stable", () => {
  const first=manualDispatchCommand(orderId,body,"operator","key");
  assert.equal(first.fingerprint,manualDispatchCommand(orderId,body,"operator","key").fingerprint);
  assert.notEqual(first.fingerprint,manualDispatchCommand(orderId,{...body,service:"Other"},"operator","key").fingerprint);
  assert.notEqual(first.fingerprint,manualDispatchCommand(orderId,body,"other-operator","key").fingerprint);
});
test("packing and dispatch routes require separate verified permissions before touching data", async () => {
  const service = new FulfilmentService(false,new ManualTestFulfilmentProvider(),{} as PostgresFulfilmentRepository);
  const packing = new Request(`https://ops.example/operations/orders/${orderId}/packing`);
  const dispatch = () => new Request(`https://ops.example/operations/orders/${orderId}/dispatch`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":"key"},body:JSON.stringify(body)});
  assert.equal((await handleOperationsRequest(packing,ops,undefined,undefined,service)).status,401);
  for (const permissions of [[],["orders:read"],["fulfilment:dispatch"]] as const) assert.equal((await handleOperationsRequest(packing,ops,{id:"operator",permissions},undefined,service)).status,403);
  assert.equal((await handleOperationsRequest(dispatch(),ops,{id:"operator",permissions:["fulfilment:read"]},undefined,service)).status,403);
  assert.equal((await handleOperationsRequest(dispatch(),ops,{id:"operator",permissions:["fulfilment:dispatch"]},undefined,service)).status,503);
  const protectedHandler=createProtectedOperationsHandler(ops,{authenticate:async()=>undefined},undefined,service);
  assert.equal((await protectedHandler(dispatch())).status,401);
});

const databaseUrl=process.env.MANUAL_DISPATCH_TEST_DATABASE_URL;
test("real PostgreSQL manual dispatch, security, rollback and concurrency", {skip:!databaseUrl}, async t => {
  const url=new URL(databaseUrl!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname.endsWith("_dispatch_test")&&!url.search&&process.env.NODE_ENV!=="production","Only a disposable local *_dispatch_test database is permitted");
  const schema="dispatch_"+randomUUID().replaceAll("-","");
  const admin=new pg.Pool({connectionString:databaseUrl});
  await admin.query("SELECT pg_advisory_lock(80317)");await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool=new pg.Pool({connectionString:databaseUrl,max:12,options:`-c search_path=${schema},public`});
  try {
    for(const file of (await readdir(resolve("db/migrations"))).filter(name=>name.endsWith(".sql")).sort()) await pool.query(await readFile(resolve("db/migrations",file),"utf8"));
    const product=(await pool.query("INSERT INTO products(sku,slug,name,description,status,price_minor,currency,tax_code,content_version,shipping_weight_grams) VALUES('SYNTHETIC','synthetic','Synthetic test item','Test only','private',100,'GBP','TEST','test',500) RETURNING id")).rows[0].id;
    await pool.query("INSERT INTO inventory_levels(product_id,location_key,available_quantity,reserved_quantity,source,source_updated_at) VALUES($1,'test',1000,0,'synthetic',now())",[product]);
    const zone=(await pool.query("INSERT INTO shipping_zones(zone_key,name,status) VALUES('synthetic','Synthetic','test') RETURNING id")).rows[0].id;
    await pool.query("INSERT INTO shipping_zone_countries(country_code,zone_id,destination_status) VALUES('GB',$1,'test')",[zone]);
    const method=(await pool.query("INSERT INTO shipping_methods(method_key,name,description,status) VALUES('synthetic','Synthetic','Test only','test') RETURNING id")).rows[0].id;
    const rate=(await pool.query("INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from) VALUES($1,$2,'GB',0,'GBP','test',now()) RETURNING id",[zone,method])).rows[0].id;
    const repository=new PostgresFulfilmentRepository(pool);
    const service=new FulfilmentService(true,new ManualTestFulfilmentProvider(),repository);
    const checkout=new PostgresCheckoutRepository(pool);
    const collectionMethod=(await pool.query("INSERT INTO shipping_methods(method_key,name,description,status) VALUES('inpost-locker-shop','InPost locker/shop collection','Test only','test') RETURNING id")).rows[0].id;
    const collectionRate=(await pool.query("INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from) VALUES($1,$2,'GB',259,'GBP','test',now()) RETURNING id",[zone,collectionMethod])).rows[0].id;
    const requestedPoint={name:"Synthetic requested point",address:"1 Test Street, London",postalCode:"SW1A 1AA",locationId:"UK00373494"};
    const fixture=async(collection=false)=>{
      const selectedRate=(await checkout.getShipping("GB"))!.rates.find(r=>r.id===(collection?collectionRate:rate))!;
      const shippingPricingSnapshot={schemaVersion:2 as const,rateRevision:shippingRateRevision(selectedRate),quoteRevision:"f".repeat(64),selectedAt:new Date().toISOString(),quantity:1,totalWeightGrams:500,billableWeightGrams:null,minimumWeightGrams:null,maximumWeightGrams:null,minimumSubtotalMinor:null,maximumSubtotalMinor:null,packagingProfileVersion:null,rateCountryCode:selectedRate.countryCode ?? null,effectiveFrom:selectedRate.effectiveFrom.toISOString(),effectiveTo:selectedRate.effectiveTo?.toISOString() ?? null,freeShippingThresholdMinor:null};
      const id=randomUUID(),number="SYNTHETIC-"+id;
      await checkout.createOrder({id,orderNumber:number,status:"draft",product:{id:product,sku:"SYNTHETIC",slug:"synthetic",name:"Synthetic test item",status:"private",priceMinor:100,unitTaxMinor:0,currency:"GBP",shippingWeightGrams:500,availableQuantity:1000},quantity:1,subtotalMinor:100,taxMinor:0,deliveryMinor:collection?259:0,totalMinor:collection?359:100,currency:"GBP",shippingPricingSnapshot,shippingApproval:"test",shippingRateId:collection?collectionRate:rate,email:id+"@example.test",deliveryAddress:{givenName:"Synthetic",familyName:"Customer",line1:"1 Test Street",locality:"London",postalCode:"SW1A 1AA",countryCode:"GB",...(collection?{phone:"+447700900123",collectionPoint:requestedPoint}:{})}},randomUUID(),"f".repeat(64));
      await pool.query("UPDATE orders SET status='paid' WHERE id=$1",[id]);
      const payment=(await pool.query("INSERT INTO payments(order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key) VALUES($1,'manual-test',$2,'captured',$4,'GBP',$3) RETURNING id",[id,randomUUID(),randomUUID(),collection?359:100])).rows[0].id;
      await service.requestForPaidOrder(id,"synthetic-paid:"+id);
      const f=(await pool.query("SELECT id,request_snapshot FROM fulfilments WHERE order_id=$1",[id])).rows[0];
      return {id,payment,fulfilmentId:f.id,request:f.request_snapshot,body:{...body,fulfilmentId:f.id}};
    };
    const dispatch=(f:Awaited<ReturnType<typeof fixture>>,key=randomUUID(),changes:Record<string,unknown>={})=>service.dispatchManual(f.id,{...f.body,...changes},"named-operator",key);
    const counts=async(id:string)=>(await pool.query(`SELECT
      (SELECT count(*)::int FROM fulfilment_events e JOIN fulfilments f ON f.id=e.fulfilment_id WHERE f.order_id=$1 AND target_status='dispatched') events,
      (SELECT count(*)::int FROM outbox_events WHERE event_type='fulfilment.dispatched' AND payload->>'orderId'=$1::text) outbox,
      (SELECT count(*)::int FROM audit_events a JOIN fulfilments f ON f.id=a.entity_id WHERE f.order_id=$1 AND action='fulfilment.dispatched') audits`,[id])).rows[0];
    await t.test("InPost original snapshot, unavailable hold, authorised alternative and duplicate dispatch",async()=>{
      const f=await fixture(true);
      const packing=await service.packingInformation(f.id,"operator");assert.equal(packing!.collection!.status,"pending");assert.equal(packing!.collection!.requested.locationId,"UK00373494");assert.equal(packing!.eligible,false);assert.equal(packing!.collection!.phone,"+447700900123");assert.equal(packing!.collection!.declaredValueMinor,100);
      const command={carrier:"InPost",service:"Locker/shop Medium",trackingReference:"SYNTHETIC-INPOST",trackingUrl:"https://inpost.co.uk/track?ref=SYNTHETIC-INPOST"};
      await assert.rejects(()=>dispatch(f,randomUUID(),command),/matched authorised point/);
      const key=randomUUID(),unavailable={expectedVersion:0,action:"unavailable",reason:"Synthetic point unavailable"};
      const first=await service.reviewCollection(f.id,unavailable,"operator",key);
      assert.deepEqual(await service.reviewCollection(f.id,unavailable,"operator",key),first);
      assert.equal((await pool.query("SELECT fulfilment_status FROM orders WHERE id=$1",[f.id])).rows[0].fulfilment_status,"manual_review");
      await assert.rejects(()=>dispatch(f,randomUUID(),command),/matched authorised point/);
      const alternative={name:"Synthetic authorised shop",address:"2 Test Road, London",postalCode:"SW1A 1AA",locationId:"UK00373495"};
      await assert.rejects(()=>service.reviewCollection(f.id,{expectedVersion:1,action:"approve-alternative",reason:"Customer agreed",point:alternative,matchedInSend:true},"operator",randomUUID()),/authorisation/);
      const review=await service.reviewCollection(f.id,{expectedVersion:1,action:"approve-alternative",reason:"Customer requested alternative",point:alternative,customerAuthorisationReference:"SYNTHETIC-SUPPORT-1",matchedInSend:true},"operator",randomUUID());assert.equal(review.version,2);
      await assert.rejects(()=>service.reviewCollection(f.id,{expectedVersion:1,action:"unavailable",reason:"Stale"},"operator",randomUUID()),/review changed/);
      const updated=await service.packingInformation(f.id,"operator");assert.deepEqual(updated!.collection!.requested,requestedPoint);assert.deepEqual(updated!.collection!.current,alternative);assert.equal(updated!.collection!.history[1]!.point.locationId,"UK00373495");assert.equal(updated!.eligible,true);assert.equal(updated!.collection!.history.length,2);assert.equal(updated!.collection!.history[1]!.customerAuthorisationReference,"SYNTHETIC-SUPPORT-1");
      await assert.rejects(()=>dispatch(f,key,command),/collection review/);
      await assert.rejects(()=>pool.query("UPDATE orders SET delivery_address_snapshot='{}'::jsonb WHERE id=$1",[f.id]),/destination is immutable/);
      await assert.rejects(()=>pool.query("UPDATE inpost_collection_reviews SET reason='changed' WHERE order_id=$1",[f.id]),/append-only/);
      const dispatchKey=randomUUID();const result=await dispatch(f,dispatchKey,command);assert.deepEqual(await dispatch(f,dispatchKey,command),result);await assert.rejects(()=>dispatch(f,randomUUID(),command));assert.deepEqual(await counts(f.id),{events:1,outbox:1,audits:1});
      await assert.rejects(()=>service.reviewCollection(f.id,{expectedVersion:2,action:"unavailable",reason:"Key reuse"},"operator",dispatchKey),/another operator command/);
      await assert.rejects(()=>service.reviewCollection(f.id,{expectedVersion:2,action:"unavailable",reason:"After dispatch"},"operator",randomUUID()),/undispatched/);
      await pool.query("INSERT INTO outbox_events(event_key,event_type,aggregate_type,aggregate_id,payload) VALUES($1,'payment.paid','payment',$2,$3::jsonb)",["synthetic-paid:"+f.id,f.payment,JSON.stringify({orderId:f.id})]);
      const messages:{idempotencyKey:string;text:string;html:string}[]=[];
      const consumer=new TransactionalCommunicationConsumer(true,new PostgresCommunicationRepository(pool),{key:"synthetic-no-send",send:async m=>{messages.push(m);return {providerReference:randomUUID(),acceptedAt:new Date().toISOString()};}});
      while((await consumer.consumeOne()).outcome!=="empty"){}
      const order=messages.find(m=>m.idempotencyKey==="communication:order-confirmation:"+f.id);assert.ok(order);assert.match(order.text,/Synthetic requested point/);assert.match(order.text,/£2.59/);
      const email=messages.find(m=>m.idempotencyKey==="communication:dispatch:"+f.fulfilmentId);assert.ok(email);assert.match(email.text,/Synthetic authorised shop/);assert.match(email.text,/SYNTHETIC-INPOST/);assert.doesNotMatch(email.text,/ready to collect/);assert.equal(messages.length,2);
      assert.equal((await consumer.consumeOne()).outcome,"empty");
    });
    await t.test("concurrent collection reviews use version fencing and do not silently replace a point",async()=>{
      const f=await fixture(true),input={expectedVersion:0,action:"confirm-match",reason:"Synthetic match",matchedInSend:true};
      const results=await Promise.allSettled([service.reviewCollection(f.id,input,"operator",randomUUID()),service.reviewCollection(f.id,input,"operator",randomUUID())]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
      assert.equal((await pool.query("SELECT count(*)::int n FROM inpost_collection_reviews WHERE order_id=$1",[f.id])).rows[0].n,1);
    });
    await t.test("normal checkout snapshot produces correct fulfilment name without snapshot mutation",async()=>{
      const f=await fixture();assert.equal(f.request.deliveryAddress.recipientName,"Synthetic Customer");
      const snapshot=(await pool.query("SELECT delivery_address_snapshot FROM orders WHERE id=$1",[f.id])).rows[0].delivery_address_snapshot;
      assert.equal(snapshot.givenName,"Synthetic");assert.equal(snapshot.familyName,"Customer");assert.equal(snapshot.recipientName,undefined);
    });
    await t.test("authorised packing access is no-store and audited; ordinary order readers are rejected",async()=>{
      const f=await fixture();const request=new Request(`https://ops.example/operations/orders/${f.id}/packing`);
      const response=await handleOperationsRequest(request,ops,{id:"packing-operator",permissions:["fulfilment:read"]},undefined,service);
      assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
      const packing=await response.json() as PackingInformation;assert.equal(packing.address.recipientName,"Synthetic Customer");assert.equal(packing.items[0]!.quantity,1);assert.equal(packing.eligible,true);
      assert.equal((await handleOperationsRequest(request,ops,{id:"viewer",permissions:["orders:read"]},undefined,service)).status,403);
      assert.equal((await pool.query("SELECT actor_id FROM audit_events WHERE entity_id=$1 AND action='fulfilment.packing_viewed'",[f.id])).rows[0].actor_id,"packing-operator");
    });
    for(const status of ["draft","pending_payment","cancelled","partially_refunded","refunded"]) await t.test(status+" orders cannot dispatch",async()=>{
      const f=await fixture();await pool.query("UPDATE orders SET status=$2 WHERE id=$1",[f.id,status]);
      await assert.rejects(()=>dispatch(f),/eligible paid/);assert.deepEqual(await counts(f.id),{events:0,outbox:0,audits:0});
    });
    await t.test("authorised but uncaptured payment cannot dispatch",async()=>{
      const f=await fixture();await pool.query("UPDATE payments SET status='authorised' WHERE id=$1",[f.payment]);await assert.rejects(()=>dispatch(f),/captured payment/);
    });
    for(const status of ["queued","dispatched","cancelled","returned","manual_review"]) await t.test("invalid order fulfilment state "+status,async()=>{
      const f=await fixture();await pool.query("UPDATE orders SET fulfilment_status=$2 WHERE id=$1",[f.id,status]);await assert.rejects(()=>dispatch(f),/accepted manual fulfilment/);
    });
    await t.test("wrong selected fulfilment and ineligible record cannot dispatch",async()=>{
      const f=await fixture();await assert.rejects(()=>dispatch(f,randomUUID(),{fulfilmentId:randomUUID()}),/accepted manual/);
      await pool.query("UPDATE fulfilments SET status='queued' WHERE id=$1",[f.fulfilmentId]);await assert.rejects(()=>dispatch(f),/accepted manual/);
    });
    await t.test("refund reservation blocks dispatch before order status changes",async()=>{
      const f=await fixture();await pool.query("INSERT INTO refunds(payment_id,status,amount_minor,currency,reason,idempotency_key) VALUES($1,'created',50,'GBP','customer_request',$2)",[f.payment,randomUUID()]);
      await assert.rejects(()=>dispatch(f),/Refund activity/);
    });
    await t.test("success stores authoritative metadata and named audit once; same command replays, changed key payload conflicts",async()=>{
      const f=await fixture(),key=randomUUID();const result=await dispatch(f,key);
      assert.deepEqual(await dispatch(f,key),result);
      await assert.rejects(()=>dispatch(f,key,{service:"Other"}),/different or unfinished/);
      const row=(await pool.query("SELECT * FROM fulfilments WHERE id=$1",[f.fulfilmentId])).rows[0];
      assert.equal(row.status,"dispatched");assert.equal(row.tracking_service,"Tracked 48");assert.equal(row.tracking_url,body.trackingUrl);
      const audit=(await pool.query("SELECT actor_id,created_at,change_summary FROM audit_events WHERE entity_id=$1 AND action='fulfilment.dispatched'",[f.fulfilmentId])).rows[0];
      assert.equal(audit.actor_id,"named-operator");assert.equal(audit.change_summary.handoverConfirmed,true);assert.equal(audit.change_summary.state,"dispatched");assert.ok(audit.created_at);assert.ok(!JSON.stringify(audit).includes("Test Street"));
      assert.deepEqual(await counts(f.id),{events:1,outbox:1,audits:1});
    });
    await t.test("no URL dispatch keeps carrier-neutral data and safe no-link communication",async()=>{
      const f=await fixture();await dispatch(f,randomUUID(),{carrier:"DPD",service:"Economy",trackingUrl:""});
      const row=(await pool.query("SELECT tracking_carrier,tracking_service,tracking_url FROM fulfilments WHERE id=$1",[f.fulfilmentId])).rows[0];
      assert.deepEqual(row,{tracking_carrier:"DPD",tracking_service:"Economy",tracking_url:null});
    });
    await t.test("concurrent same-key submissions replay one atomic result",async()=>{
      const f=await fixture(),key=randomUUID();const results=await Promise.all([dispatch(f,key),dispatch(f,key)]);
      assert.deepEqual(results[0],results[1]);assert.deepEqual(await counts(f.id),{events:1,outbox:1,audits:1});
    });
    await t.test("concurrent different-key submissions cannot dispatch twice",async()=>{
      const f=await fixture();const results=await Promise.allSettled([dispatch(f),dispatch(f)]);
      assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.deepEqual(await counts(f.id),{events:1,outbox:1,audits:1});
    });
    await t.test("failed audit persistence rolls back state, event, command and outbox",async()=>{
      const f=await fixture(),key=randomUUID();
      await pool.query("ALTER TABLE audit_events ADD CONSTRAINT synthetic_reject_dispatch CHECK (action <> 'fulfilment.dispatched') NOT VALID");
      try{await assert.rejects(()=>dispatch(f,key));}finally{await pool.query("ALTER TABLE audit_events DROP CONSTRAINT synthetic_reject_dispatch");}
      assert.equal((await pool.query("SELECT status FROM fulfilments WHERE id=$1",[f.fulfilmentId])).rows[0].status,"accepted");
      assert.deepEqual(await counts(f.id),{events:0,outbox:0,audits:0});
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM operator_commands WHERE idempotency_key=$1",[key])).rows[0].count,0);
      await dispatch(f,key);
    });
    await t.test("protected dispatch endpoint attributes verified operator and preserves no-store",async()=>{
      const f=await fixture();
      const request=new Request(`https://ops.example/operations/orders/${f.id}/dispatch`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":randomUUID()},body:JSON.stringify(f.body)});
      const handler=createProtectedOperationsHandler(ops,{authenticate:async()=>({id:"verified-dispatch-operator",permissions:["fulfilment:dispatch"]})},undefined,service);
      const response=await handler(request);assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
      assert.equal((await pool.query("SELECT actor_id FROM audit_events WHERE entity_id=$1 AND action='fulfilment.dispatched'",[f.fulfilmentId])).rows[0].actor_id,"verified-dispatch-operator");
    });
    await t.test("pending concurrent refund and busy order cannot be bypassed",async()=>{
      const f=await fixture(),client=await pool.connect();
      try {
        await client.query("BEGIN");await client.query("SELECT id FROM payments WHERE id=$1 FOR UPDATE",[f.payment]);
        await client.query("INSERT INTO refunds(payment_id,status,amount_minor,currency,reason,idempotency_key) VALUES($1,'pending',50,'GBP','customer_request',$2)",[f.payment,randomUUID()]);
        const outcome=assert.rejects(()=>dispatch(f),/Refund activity/);
        await client.query("COMMIT");await outcome;
        const other=await fixture();await client.query("BEGIN");await client.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE",[other.id]);
        await assert.rejects(()=>dispatch(other),/Order is busy/);await client.query("ROLLBACK");
      } finally {await client.query("ROLLBACK");client.release();}
    });
    await t.test("multiple fulfilments, mismatched payment and test/live provider mismatch are rejected",async()=>{
      const f=await fixture();await pool.query("INSERT INTO fulfilments(order_id,provider,provider_reference,status,idempotency_key) VALUES($1,'manual-test',$2,'accepted',$3)",[f.id,randomUUID(),randomUUID()]);
      await assert.rejects(()=>dispatch(f),/accepted manual/);
      const other=await fixture();await pool.query("UPDATE payments SET amount_minor=99 WHERE id=$1",[other.payment]);await assert.rejects(()=>dispatch(other),/captured payment/);
      const live=await fixture();await pool.query("UPDATE fulfilments SET provider='manual-live' WHERE id=$1",[live.fulfilmentId]);await assert.rejects(()=>dispatch(live),/accepted manual/);
    });
    await t.test("existing communication ledger sends each fulfilment once with correct optional links",async()=>{
      const messages:{idempotencyKey:string;html:string}[]=[];
      const consumer=new TransactionalCommunicationConsumer(true,new PostgresCommunicationRepository(pool),{key:"synthetic-no-send",send:async message=>{messages.push(message);return {providerReference:randomUUID(),acceptedAt:new Date().toISOString()};}});
      for(let i=0;i<100;i++){if((await consumer.consumeOne()).outcome==="empty")break;}
      assert.ok(messages.length>0);assert.equal(new Set(messages.map(m=>m.idempotencyKey)).size,messages.length);
      assert.ok(messages.some(m=>m.html.includes("Track your delivery")));
      assert.ok(messages.some(m=>m.html.includes("DPD")&&!m.html.includes("Track your delivery")));
      assert.equal((await consumer.consumeOne()).outcome,"empty");
    });
    await t.test("public UUID status remains coarse even after dispatch",async()=>{
      const f=await fixture();await dispatch(f);
      const response=await handleOrderStatusRequest(new Request(`https://api.example/orders/${f.id}/status`),new PostgresOrderStatusRepository(pool),"https://shop.example");
      assert.deepEqual(await response.json(),{state:"paid"});
    });
  } finally {await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});

import {collectionReviewCommand} from "./collection-review.js";
test("collection review requires a Send match and recorded customer authority for alternatives",()=>{
  const input={expectedVersion:0,action:"confirm-match",reason:"Matched synthetic point",matchedInSend:true};
  assert.equal(collectionReviewCommand(orderId,input,"operator","review-1").action,"confirm-match");
  assert.throws(()=>collectionReviewCommand(orderId,{...input,matchedInSend:false},"operator","review-1"),/matched/);
  assert.throws(()=>collectionReviewCommand(orderId,{...input,action:"approve-alternative",point:{name:"Test",address:"Test Road",postalCode:"SW1A 1AA"}},"operator","review-1"),/authorisation/);
  assert.throws(()=>collectionReviewCommand(orderId,{...input,point:{name:"Changed",address:"Test Road",postalCode:"SW1A 1AA"}},"operator","review-1"),/Only an authorised/);
  const command=collectionReviewCommand(orderId,{...input,action:"unavailable",matchedInSend:false},"operator","review-2");assert.equal(command.action,"unavailable");
});
test("collection review endpoint preserves existing authentication, dispatch permission and disabled gates",async()=>{
  const service=new FulfilmentService(false,new ManualTestFulfilmentProvider(),{} as never);
  const request=()=>new Request('https://ops.example/operations/orders/'+orderId+'/collection-review',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'review-test'},body:JSON.stringify({expectedVersion:0,action:'unavailable',reason:'Not available'})});
  assert.equal((await handleOperationsRequest(request(),ops,undefined,undefined,service)).status,401);
  assert.equal((await handleOperationsRequest(request(),ops,{id:'operator',permissions:['fulfilment:read']},undefined,service)).status,403);
  assert.equal((await handleOperationsRequest(request(),ops,{id:'operator',permissions:['fulfilment:dispatch']},undefined,service)).status,503);
});
