import test from "node:test";
import assert from "node:assert/strict";
import {PostgresFulfilmentOutboxConsumer} from "../../build/commerce-api/apps/commerce-api/src/fulfilment/outbox.js";

function harness({event=true, calls=[]}={}){
  const row={id:"evt-1",event_key:"payment.paid:synthetic",payload:{orderId:"synthetic-order"}};
  const state={status:"pending",token:null,attempts:0,started:0,completed:null};
  const client={
    async query(sql,args=[]){
      calls.push({sql,args});
      if(sql.includes("FOR UPDATE SKIP LOCKED")) {
        if(!event||state.status==="processing")return {rowCount:0,rows:[]};
        return {rowCount:1,rows:[row]};
      }
      if(sql.includes("claim_token=$2")) {
        state.status="processing";state.token=args[1];state.attempts++;return {rowCount:1,rows:[]};
      }
      return {rowCount:0,rows:[]};
    },release(){}
  };
  const pool={async connect(){return client;},async query(sql,args=[]){
    calls.push({sql,args});
    if(sql.includes("claim_token = $4") && state.status==="processing" && state.token===args[3]){
      state.status=args[1];state.completed=args[1];state.token=null;return {rowCount:1,rows:[]};
    }
    return {rowCount:0,rows:[]};
  }};
  return {pool,state,calls};
}
test("one claim produces fenced successful completion",async()=>{
 const h=harness();const service={async requestForPaidOrder(){return {outcome:"created"}}};
 const consumer=new PostgresFulfilmentOutboxConsumer(h.pool,service);
 assert.equal(await consumer.runOnce(),"processed");
 assert.equal(h.state.completed,"published");
 assert.equal(h.state.token,null);
 const claim=h.calls.find(x=>x.sql.includes("claim_token=$2"));
 const complete=h.calls.find(x=>x.sql.includes("claim_token = $4"));
 assert.match(claim.args[1],/^[a-f0-9-]{36}$/);
 assert.equal(complete.args[3],claim.args[1]);
});
test("stale invocation cannot finish after another worker acquires ownership",async()=>{
 const h=harness();const service={async requestForPaidOrder(){
    h.state.token="new-worker-token";
 }};
 const consumer=new PostgresFulfilmentOutboxConsumer(h.pool,service);
 await assert.rejects(consumer.runOnce(),/fulfilment_claim_lost/);
 assert.equal(h.state.completed,null);
 assert.equal(h.state.token,"new-worker-token");
 const attempts=h.calls.filter(x=>x.sql.includes("claim_token = $4"));
 assert.equal(attempts.length,1);
});
test("service failure marks only its own claim as failed",async()=>{
 const h=harness();const consumer=new PostgresFulfilmentOutboxConsumer(h.pool,{async requestForPaidOrder(){throw Error("synthetic failure")}});
 await assert.rejects(consumer.runOnce(),/synthetic failure/);
 assert.equal(h.state.completed,"failed");
});
test("idle queue does not invoke fulfilment service",async()=>{
 const h=harness({event:false});let invoked=0;
 const consumer=new PostgresFulfilmentOutboxConsumer(h.pool,{async requestForPaidOrder(){invoked++}});
 assert.equal(await consumer.runOnce(),"idle");
 assert.equal(invoked,0);
});
test("bounded automatic retry settings reject unsafe values",()=>{
 const h=harness();
 assert.throws(()=>new PostgresFulfilmentOutboxConsumer(h.pool,{},0),/retry limit/);
 assert.throws(()=>new PostgresFulfilmentOutboxConsumer(h.pool,{},3,2),/claim lease/);
});
