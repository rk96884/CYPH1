import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import worker, {scheduledBoundedCommerce} from "./src/bounded-commerce-worker.mjs";

const marker={cron:"__cyph1_bounded_commerce__"};
const flags={
  COMMERCE_BOUNDED_WORKER_ENABLED:"true",
  COMMERCE_BOUNDED_OWNER_AUTHORIZED:"true",
  COMMERCE_LAUNCH_SAFETY_APPROVED:"true",
  COMMERCE_BOUNDED_INTEGRATION_ENABLED:"true"
};
test("unrecognized or regular cron cannot execute real adapter",async()=>{
 let calls=0;const execute=async()=>{calls++;return {status:"completed",results:[]}};
 assert.equal((await scheduledBoundedCommerce({cron:"*/5 * * * *"},flags,execute)).status,"not_authorized_event");
 assert.equal((await scheduledBoundedCommerce(undefined,flags,execute)).status,"not_authorized_event");
 assert.equal(calls,0);
});
test("every separate approval gate fails closed before opening database",async()=>{
 let calls=0;const execute=async()=>{calls++};
 for(const key of Object.keys(flags)){
   const env={...flags};delete env[key];
   assert.equal((await scheduledBoundedCommerce(marker,env,execute)).status,"disabled");
 }
 assert.equal((await scheduledBoundedCommerce(marker,{},execute)).status,"disabled");
 assert.equal(calls,0);
});
test("only explicitly approved manual marker delegates to integration once",async()=>{
 let calls=0;const execute=async()=>{calls++;return {status:"completed",results:[{consumer:"communications",outcome:"idle"}]}};
 const result=await scheduledBoundedCommerce(marker,flags,execute);
 assert.equal(calls,1);assert.equal(result.results[0].outcome,"idle");
});
test("entrypoint HTTP denies every request and exposes no commerce endpoint",async()=>{
 assert.equal((await worker.fetch(new Request("https://example.invalid/commerce"))).status,404);
});
test("release config has zero triggers, exact production binding and all gates OFF",async()=>{
 const c=await readFile(new URL("./wrangler.bounded-commerce.toml",import.meta.url),"utf8");
 const active=c.split("\n").filter(s=>!s.trimStart().startsWith("#")).join("\n");
 assert.doesNotMatch(active,/\[triggers\]|\bcrons\s*=|BREVO_API_KEY|DATABASE_URL/);
 assert.match(active,/id = "6853d927cd45484390f49a73ff260022"/);
 for(const name of ["COMMERCE_BOUNDED_WORKER_ENABLED","COMMERCE_BOUNDED_OWNER_AUTHORIZED","COMMERCE_LAUNCH_SAFETY_APPROVED","COMMERCE_BOUNDED_INTEGRATION_ENABLED","COMMERCE_HYPERDRIVE_TLS_REVIEWED","COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED","COMMERCE_BOUNDED_FULFILMENT_ENABLED"]){
  assert.match(active,new RegExp(name+' = "false"'));
 }
});
