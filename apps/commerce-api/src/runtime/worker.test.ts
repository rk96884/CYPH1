import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { databaseConfiguration } from "./database.js";
import { runCommerceWorker, waitForWorker, workerEnabled } from "./worker.js";
test("worker explicitly disabled by default and rejects invalid enablement",()=>{assert.equal(workerEnabled(undefined),false);assert.throws(()=>workerEnabled("yes"));assert.equal(workerEnabled("true"),true);});
test("production database TLS verifies certificates and cannot be overridden by URL parameters",()=>{
  const env={NODE_ENV:"production",DATABASE_URL:"postgresql://synthetic@localhost/test",DATABASE_SSL:"true"};assert.deepEqual(databaseConfiguration(env).ssl,{rejectUnauthorized:true});
  for(const change of [{DATABASE_SSL:"false"},{DATABASE_SSL:undefined},{DATABASE_SSL:"yes"},{DATABASE_URL:env.DATABASE_URL+"?sslmode=no-verify"},{DATABASE_URL:env.DATABASE_URL+"?sslcert=bad"}])assert.throws(()=>databaseConfiguration({...env,...change}));
  assert.equal(databaseConfiguration({DATABASE_URL:env.DATABASE_URL,NODE_ENV:"test"}).ssl,false);
});
test("consumer errors are isolated, logs omit error data and shutdown drains both loops",async()=>{
  const stop=new AbortController();let fulfilments=0,communications=0;const logs:unknown[]=[];const delays:number[]=[];
  await runCommerceWorker([{name:"fulfilment",run:async()=>{fulfilments++;throw new Error("secret recipient and provider body");}},{name:"communications",run:async()=>{communications++;if(communications===3)stop.abort();return {outcome:"sent"};}}],stop.signal,value=>logs.push(value),async(delay)=>{delays.push(delay);});
  assert.ok(fulfilments>=2);assert.equal(communications,3);assert.ok(delays.every(value=>value>=250&&value<=5000));assert.doesNotMatch(JSON.stringify(logs),/secret|recipient|body/);
});
test("idle backoff is bounded and signal interrupts waiting promptly",async()=>{
  const stop=new AbortController();const delays:number[]=[];
  await runCommerceWorker([{name:"communications",run:async()=>({outcome:"empty"})}],stop.signal,()=>{},async(delay)=>{delays.push(delay);if(delays.length===8)stop.abort();});
  assert.equal(delays.at(-1),5000);const waiting=waitForWorker(5000,stop.signal);await waiting;
  const active=new AbortController();const pending=waitForWorker(5000,active.signal);active.abort();await pending;
});

test("actual worker entry exits disabled and fails closed without exposing secrets",()=>{
 const entry=fileURLToPath(new URL("./commerce-worker.js",import.meta.url));
 const base={...process.env,COMMERCE_WORKER_ENABLED:"false",DATABASE_URL:"deliberately-invalid",COMMUNICATIONS_ENABLED:"false",COMMUNICATION_PROVIDER:"disabled",COMMUNICATIONS_LIVE_SEND_ENABLED:"false",BREVO_API_KEY:"synthetic-private-value",FULFILMENT_MODE:"disabled",FULFILMENT_PROVIDER:"disabled"};
 const disabled=spawnSync(process.execPath,[entry],{env:base,encoding:"utf8",timeout:5000});assert.equal(disabled.status,0);assert.equal(disabled.stdout,"");assert.equal(disabled.stderr,"");
 for(const change of [{NODE_ENV:"production",COMMUNICATION_PROVIDER:"manual-test"},{NODE_ENV:"production",COMMUNICATIONS_ENABLED:"true",COMMUNICATION_PROVIDER:"brevo"},{COMMERCE_WORKER_ENABLED:"invalid"}]){
  const result=spawnSync(process.execPath,[entry],{env:{...base,COMMERCE_WORKER_ENABLED:"true",...change},encoding:"utf8",timeout:5000});assert.equal(result.status,1);assert.doesNotMatch(result.stderr,/synthetic-private-value|deliberately-invalid/);assert.match(result.stderr,/commerce_worker_startup_or_runtime_failed/);
 }
});
test("shutdown waits for active work and prevents another claim",async()=>{
 const stop=new AbortController();let release!:()=>void;let calls=0;
 const active=new Promise<void>(resolve=>{release=resolve;});
 const running=runCommerceWorker([{name:"communications",run:async()=>{calls++;await active;return {outcome:"sent"};}}],stop.signal,()=>{});
 stop.abort();release();await running;assert.equal(calls,1);
});
