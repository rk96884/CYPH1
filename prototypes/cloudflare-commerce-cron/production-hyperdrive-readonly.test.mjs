import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import worker,{verifyProductionHyperdrive} from "./src/production-hyperdrive-readonly.mjs";

test("disabled or missing binding never opens a connection",async()=>{
 let n=0;const pool=()=>{n++;throw Error("should not connect")};
 assert.deepEqual(await verifyProductionHyperdrive({},pool),{status:"disabled"});
 assert.deepEqual(await verifyProductionHyperdrive({PRODUCTION_HYPERDRIVE_READONLY_PROBE:"true"},pool),{status:"missing_binding"});
 assert.equal(n,0);
});
test("production database and restricted role are both verified",async()=>{
 let ended=0;
 const pool=()=>({async query(sql){assert.equal(sql,"SELECT current_database() AS database_name, current_user AS role_name");return {rows:[{database_name:"cyph1_commerce_production",role_name:"cyph1_hyperdrive_prod_worker"}]}},async end(){ended++}});
 assert.deepEqual(await verifyProductionHyperdrive({PRODUCTION_HYPERDRIVE_READONLY_PROBE:"true",HYPERDRIVE:{connectionString:"fake"}},pool),{status:"verified"});
 assert.equal(ended,1);
});
test("incorrect database never reports success, connection cleaned",async()=>{
 let ended=0;
 const pool=()=>({async query(){return {rows:[{database_name:"cyph1_commerce_development",role_name:"cyph1_hyperdrive_prod_worker"}]}},async end(){ended++}});
 assert.deepEqual(await verifyProductionHyperdrive({PRODUCTION_HYPERDRIVE_READONLY_PROBE:"true",HYPERDRIVE:{connectionString:"fake"}},pool),{status:"identity_mismatch"});
 assert.equal(ended,1);
});
test("no public endpoint, triggers or enabled runtime flags",async()=>{
 assert.equal((await worker.fetch()).status,404);
 const c=await readFile(new URL("./wrangler.production-hyperdrive-readonly.toml",import.meta.url),"utf8");
 const active=c.split("\n").filter(x=>!x.trimStart().startsWith("#")).join("\n");
 assert.match(active,/PRODUCTION_HYPERDRIVE_READONLY_PROBE = "false"/);
 assert.match(active,/6853d927cd45484390f49a73ff260022/);
 assert.doesNotMatch(active,/\[triggers\]|BREVO_API_KEY|COMMERCE_ENABLED/);
});
