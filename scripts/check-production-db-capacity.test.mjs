import assert from "node:assert/strict";
import test from "node:test";
import { loadProbeConfig, runProbe } from "./check-production-db-capacity.mjs";

const env = {
  PRODUCTION_DB_PROBE_CONFIRM:"synthetic-read-only-no-commerce",
  DATABASE_URL:"postgresql://user:pass@db.example/cyph1_commerce_production",
  COMMERCE_ENABLED:"false", CHECKOUT_HTTP_ENABLED:"false", PAYMENT_WEBHOOKS_ENABLED:"false",
  PAYMENT_PROVIDER:"disabled", FULFILMENT_MODE:"disabled", FULFILMENT_PROVIDER:"disabled",
};

test("configuration fails closed",()=>{
  assert.throws(()=>loadProbeConfig({...env,PRODUCTION_DB_PROBE_CONFIRM:"yes"}),/exactly/);
  assert.throws(()=>loadProbeConfig({...env,DATABASE_URL:"postgresql://u:p@db.example/cyph1_commerce_development"}),/does not contain production/);
  assert.throws(()=>loadProbeConfig({...env,COMMERCE_ENABLED:"true"}),/locked commerce baseline/);
  assert.throws(()=>loadProbeConfig({...env,PRODUCTION_DB_PROBE_CONCURRENCY:"9"}),/1 to 8/);
  assert.throws(()=>loadProbeConfig({...env,PRODUCTION_DB_PROBE_REQUESTS:"101"}),/2 to 100/);
});

test("probe is bounded and issues only SELECT 1",async()=>{
  let queries=0, ended=false, clock=0;
  class Pool {
    async query(sql){ assert.equal(sql,"SELECT 1 AS probe"); queries++; clock+=2; return {rowCount:1,rows:[{probe:1}]}; }
    async end(){ ended=true; }
  }
  const result=await runProbe({config:loadProbeConfig({...env,PRODUCTION_DB_PROBE_REQUESTS:"12",PRODUCTION_DB_PROBE_CONCURRENCY:"4"}),Pool,now:()=>clock});
  assert.equal(queries,12); assert.equal(result.failures,0); assert.equal(result.requests,12); assert.equal(ended,true);
});

test("probe rejects query failures",async()=>{
  class Pool { async query(){ throw new Error("no"); } async end(){} }
  await assert.rejects(runProbe({config:loadProbeConfig({...env,PRODUCTION_DB_PROBE_REQUESTS:"2"}),Pool}),/2 of 2 queries failed/);
});
