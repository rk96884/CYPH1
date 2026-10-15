import test from "node:test";
import assert from "node:assert/strict";
import {runIsolatedOutboxConcurrency} from "./src/isolated-outbox-concurrency.mjs";

test("refuses missing credentials without creating a pool",async()=>{
 let calls=0;
 await assert.rejects(runIsolatedOutboxConcurrency("",()=>{calls++}),/required/);
 assert.equal(calls,0);
});
test("refuses production database before any mutations and closes pool",async()=>{
 const sql=[];let ended=0;
 const pool=()=>({async query(q){sql.push(q);return {rows:[{db:"cyph1_commerce_production"}]};},async end(){ended++}});
 await assert.rejects(runIsolatedOutboxConcurrency("synthetic",pool),/Development database only/);
 assert.equal(ended,1);
 assert.equal(sql.length,1);
 assert.match(sql[0],/current_database/);
});
