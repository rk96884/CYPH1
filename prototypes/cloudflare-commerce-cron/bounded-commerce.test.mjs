import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runBoundedCommerceOnce} from "./src/bounded-commerce-runner.mjs";
import worker from "./src/bounded-commerce-worker.mjs";

const authorized = { COMMERCE_BOUNDED_WORKER_ENABLED:"true", COMMERCE_BOUNDED_OWNER_AUTHORIZED:"true", COMMERCE_LAUNCH_SAFETY_APPROVED:"true", COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED:"true", COMMERCE_BOUNDED_FULFILMENT_ENABLED:"true" };

test("default disabled, no task executes",async()=>{
  let called=false;
  assert.equal((await runBoundedCommerceOnce({}, {communications:async()=>{called=true}})).status,"disabled");
  assert.equal(called,false);
  assert.equal((await worker.fetch()).status,404);
});
test("missing owner authorization or safety approval fails closed",async()=>{
  let calls=0;const tasks={communications:async()=>{calls++},fulfilment:async()=>{calls++}};
  for(const missing of ["COMMERCE_BOUNDED_OWNER_AUTHORIZED","COMMERCE_LAUNCH_SAFETY_APPROVED"]) {
    const env={...authorized}; delete env[missing];
    assert.equal((await runBoundedCommerceOnce(env,tasks)).status,"disabled");
  }
  assert.equal(calls,0);
});
test("bounded invocation runs each enabled consumer at most once in sequence",async()=>{
  const calls=[];
  const result=await runBoundedCommerceOnce(authorized,{communications:async()=>{calls.push("communications");return {outcome:"sent"};},fulfilment:async()=>{calls.push("fulfilment");return "idle";}});
  assert.deepEqual(calls,["communications","fulfilment"]);
  assert.deepEqual(result,{status:"completed",results:[{consumer:"communications",outcome:"sent"},{consumer:"fulfilment",outcome:"idle"}]});
});
test("errors are sanitized and do not expose secrets",async()=>{
  const result=await runBoundedCommerceOnce(authorized,{communications:async()=>{throw Error("API-KEY-SECRET")},fulfilment:async()=>({outcome:"processed"})});
  assert.equal(JSON.stringify(result).includes("API-KEY-SECRET"),false);
  assert.deepEqual(result.results.map(r=>r.outcome),["failed","processed"]);
});
test("Worker config binds production Hyperdrive but remains disabled with no Cron",async()=>{
  const conf=await readFile(new URL("./wrangler.bounded-commerce.toml",import.meta.url),"utf8");
  const active=conf.split("\n").filter(x=>!x.trimStart().startsWith("#")).join("\n");
  assert.doesNotMatch(active,/\[triggers\]|DATABASE_URL|BREVO_API_KEY/);
  assert.match(active,/\[\[hyperdrive\]\]/);
  assert.match(active,/binding = "HYPERDRIVE"/);
  assert.match(active,/id = "6853d927cd45484390f49a73ff260022"/);
  for(const flag of ["COMMERCE_BOUNDED_WORKER_ENABLED","COMMERCE_BOUNDED_OWNER_AUTHORIZED","COMMERCE_LAUNCH_SAFETY_APPROVED","COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED","COMMERCE_BOUNDED_FULFILMENT_ENABLED"]){
    assert.match(active,new RegExp(flag+' = "false"'));
  }
  assert.match(active,/COMMERCE_BOUNDED_WORKER_ENABLED = "false"/);
});
