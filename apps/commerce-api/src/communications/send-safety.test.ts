import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { PostgresCommunicationRepository } from "./postgres.js";
import { TransactionalCommunicationConsumer } from "./service.js";
import { CommunicationFailure } from "./failure.js";
const databaseUrl=process.env.MANUAL_DISPATCH_TEST_DATABASE_URL;
test("PostgreSQL communication fencing, ambiguity, semantic flows and terminal failures",{skip:!databaseUrl},async t=>{
  const url=new URL(databaseUrl!);assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname.endsWith("_dispatch_test")&&!url.search&&process.env.NODE_ENV!=="production");
  const schema="email_"+randomUUID().replaceAll("-","");const admin=new pg.Pool({connectionString:databaseUrl});await admin.query("SELECT pg_advisory_lock(80317)");await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool=new pg.Pool({connectionString:databaseUrl,max:8,options:`-c search_path=${schema},public`});
  try {
    for(const file of (await readdir(resolve("db/migrations"))).filter(name=>name.endsWith(".sql")).sort())await pool.query(await readFile(resolve("db/migrations",file),"utf8"));
    const repo=new PostgresCommunicationRepository(pool,3,30);
    const seed=async(eventType="payment.paid",existingOrder?:string)=>{
      const customer=randomUUID(),order=existingOrder??randomUUID(),event=randomUUID(),aggregate=randomUUID();
      if(!existingOrder){await pool.query("INSERT INTO customers(id,email_normalised,email_display) VALUES($1,$2,$2)",[customer,customer+"@example.test"]);
      await pool.query("INSERT INTO orders(id,order_number,customer_id,status,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES($1,$2,$3,'paid','GBP',100,100,'{}'::jsonb)",[order,"SYNTHETIC-"+order,customer]);}
      await pool.query("INSERT INTO outbox_events(id,event_key,event_type,aggregate_type,aggregate_id,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[event,event,eventType,eventType.startsWith("fulfilment")?"fulfilment":eventType.startsWith("refund")?"refund":"payment",aggregate,JSON.stringify({orderId:order})]);return {order,event,aggregate};
    };
    const age=async(id:string)=>pool.query("UPDATE communication_deliveries SET processing_started_at=now()-interval '31 seconds' WHERE id=$1",[id]);
    const clear=async()=>pool.query("TRUNCATE communication_deliveries,outbox_events CASCADE");
    await t.test("migration quarantines legacy in-flight claims without changing semantic identity",async()=>{
      await seed();const first=(await repo.claimNext())!;
      await pool.query("ALTER TABLE communication_deliveries DROP COLUMN claim_token, DROP COLUMN send_started_at, DROP COLUMN terminal_failure");
      await pool.query(await readFile(resolve("db/migrations/0017_communication_send_safety.sql"),"utf8"));
      const row=(await pool.query("SELECT status,deduplication_key FROM communication_deliveries WHERE id=$1",[first.deliveryId])).rows[0];assert.equal(row.status,"manual_review");assert.equal(row.deduplication_key,first.deduplicationKey);assert.equal(await repo.claimNext(),undefined);await clear();
    });
    await t.test("two consumers claim one semantic message and sent records are never reclaimed",async()=>{
      await seed();const claims=await Promise.all([repo.claimNext(),repo.claimNext()]);const one=claims.find(Boolean)!;assert.equal(claims.filter(Boolean).length,1);
      await repo.beginSend(one.deliveryId,one.claimToken);await repo.markSent(one.deliveryId,"synthetic","message-id",one.claimToken);assert.equal(await repo.claimNext(),undefined);await clear();
    });
    await t.test("stale pre-send claim is reclaimed with a new token; old completion and failure are fenced",async()=>{
      await seed();const first=(await repo.claimNext())!;await age(first.deliveryId);const second=(await repo.claimNext())!;
      assert.equal(first.deliveryId,second.deliveryId);assert.notEqual(first.claimToken,second.claimToken);
      await assert.rejects(()=>repo.beginSend(first.deliveryId,first.claimToken),/claim_lost/);
      await assert.rejects(()=>repo.markSent(first.deliveryId,"synthetic","late",first.claimToken),/claim_lost/);
      await assert.rejects(()=>repo.markFailed(first.deliveryId,"late",first.claimToken),/claim_lost/);
      await assert.rejects(()=>repo.markReview(first.deliveryId,"late",first.claimToken),/claim_lost/);
      await repo.beginSend(second.deliveryId,second.claimToken);await repo.markSent(second.deliveryId,"synthetic","current",second.claimToken);await clear();
    });
    await t.test("expired started send becomes manual review and is never automatically reclaimed",async()=>{
      await seed();const first=(await repo.claimNext())!;await repo.beginSend(first.deliveryId,first.claimToken);await age(first.deliveryId);
      await assert.rejects(()=>repo.markSent(first.deliveryId,"synthetic","late",first.claimToken),/claim_lost/);
      assert.equal(await repo.claimNext(),undefined);assert.equal((await pool.query("SELECT status FROM communication_deliveries WHERE id=$1",[first.deliveryId])).rows[0].status,"manual_review");await clear();
    });
    await t.test("explicit failure on final attempt becomes terminal and remains monitor-visible",async()=>{
      await seed();let id="";
      for(let i=1;i<=3;i++){const claim=(await repo.claimNext())!;id=claim.deliveryId;await repo.beginSend(id,claim.claimToken);await repo.markFailed(id,"provider_rate_limited",claim.claimToken);await pool.query("UPDATE communication_deliveries SET available_at=now() WHERE id=$1",[id]);}
      const row=(await pool.query("SELECT terminal_failure,attempt_count,last_error_code FROM communication_deliveries WHERE id=$1",[id])).rows[0];assert.equal(row.terminal_failure,true);assert.equal(row.attempt_count,3);assert.equal(row.last_error_code,"provider_rate_limited");assert.equal(await repo.claimNext(),undefined);await clear();
    });
    await t.test("ambiguous sends persist manual review with no automatic second provider call",async()=>{
      await seed();let sends=0;const consumer=new TransactionalCommunicationConsumer(true,repo,{key:"synthetic",send:async()=>{sends++;throw new CommunicationFailure("ambiguous","timeout");}});
      assert.equal((await consumer.consumeOne()).outcome,"manual_review");assert.equal((await consumer.consumeOne()).outcome,"empty");assert.equal(sends,1);await clear();
    });
    await t.test("known provider acceptance is retained when final completion needs reconciliation",async()=>{
      await seed();const claim=(await repo.claimNext())!;await repo.beginSend(claim.deliveryId,claim.claimToken);
      await repo.markReview(claim.deliveryId,"send_uncertain",claim.claimToken,{provider:"synthetic",reference:"accepted-message-id"});
      const row=(await pool.query("SELECT status,provider,provider_reference FROM communication_deliveries WHERE id=$1",[claim.deliveryId])).rows[0];assert.deepEqual(row,{status:"manual_review",provider:"synthetic",provider_reference:"accepted-message-id"});assert.equal(await repo.claimNext(),undefined);await clear();
    });
    await t.test("permanent rejection is terminal immediately",async()=>{
      await seed();const claim=(await repo.claimNext())!;await repo.beginSend(claim.deliveryId,claim.claimToken);await repo.markFailed(claim.deliveryId,"provider_rejected",claim.claimToken,true);
      await pool.query("UPDATE communication_deliveries SET available_at=now() WHERE id=$1",[claim.deliveryId]);assert.equal(await repo.claimNext(),undefined);assert.equal((await pool.query("SELECT terminal_failure FROM communication_deliveries WHERE id=$1",[claim.deliveryId])).rows[0].terminal_failure,true);await clear();
    });
    await t.test("all four event flows preserve semantic identity, including cancellation overlap and replay",async()=>{
      const order=await seed();await seed("fulfilment.dispatched",order.order);await seed("payment.cancelled",order.order);await seed("fulfilment.cancelled",order.order);await seed("refund.completed",order.order);await seed("payment.paid",order.order);
      const keys:string[]=[];const consumer=new TransactionalCommunicationConsumer(true,repo,{key:"synthetic",send:async message=>{keys.push(message.idempotencyKey);return {providerReference:randomUUID(),acceptedAt:new Date().toISOString()};}});
      for(let i=0;i<12;i++)await consumer.consumeOne();assert.equal(keys.length,4);
      for(const prefix of ["order-confirmation","dispatch","cancellation","refund"])assert.equal(keys.filter(key=>key.startsWith("communication:"+prefix+":")).length,1);
      assert.equal((await pool.query("SELECT count(*)::int count FROM communication_deliveries WHERE status='sent'")).rows[0].count,4);await clear();
    });
  } finally {await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
