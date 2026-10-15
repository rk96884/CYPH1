import test from "node:test";
import assert from "node:assert/strict";
import {runTransactionProbe} from "./src/hyperdrive-transaction-probe.mjs";

test("disabled probe creates no connections", async () => {
  let count = 0;
  assert.deepEqual(await runTransactionProbe({}, () => {count++;}), {status:"disabled"});
  assert.equal(count,0);
});

test("two connections skip locked row and always roll back", async () => {
  const calls = [[], []]; let ends=0, released=0, connects=0;
  const clients=[0,1].map(i=>({
    async query(sql) {
      calls[i].push(sql);
      if(sql.startsWith("SELECT current_database")) return {rows:[{database_name:"cyph1_commerce_development"}]};
      if(sql.includes("FOR UPDATE SKIP LOCKED")) return {rows:[{id:i===0?1:2}]};
      if(sql.startsWith("SELECT status")) return {rows:[{status:"pending"}]};
      return {rows:[]};
    },
    release(){released++;}
  }));
  const value=await runTransactionProbe({HYPERDRIVE_TRANSACTION_PROBE_ENABLED:"true",HYPERDRIVE:{connectionString:"synthetic"}},
    ()=>({async connect(){return clients[connects++];},async end(){ends++;}}));
  assert.equal(value.status,"verified");
  assert.equal(value.locked,true);
  assert.equal(value.rolledBack,true);
  assert.ok(calls[0].includes("ROLLBACK"));
  assert.ok(calls[1].includes("ROLLBACK"));
  assert.equal(released,2);
  assert.equal(ends,1);
});

test("wrong DB never executes table queries and cleans up", async () => {
  let released=0, ends=0, selects=0;
  const pool=()=>({async connect(){return {async query(sql){if(sql.includes("cyph1_hyperdrive_probe")) selects++;return {rows:[{database_name:"cyph1_commerce_production"}]};},release(){released++;}};},async end(){ends++;}});
  await assert.rejects(runTransactionProbe({HYPERDRIVE_TRANSACTION_PROBE_ENABLED:"true",HYPERDRIVE:{connectionString:"synthetic"}},pool),/REFUSED/);
  assert.equal(selects,0);assert.equal(released,2);assert.equal(ends,1);
});
