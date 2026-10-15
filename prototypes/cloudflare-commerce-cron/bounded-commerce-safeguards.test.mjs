import test from "node:test";
import assert from "node:assert/strict";
import { runIntegratedBoundedOnce } from "./src/bounded-commerce-tasks.mjs";

const ready = {
  COMMERCE_BOUNDED_WORKER_ENABLED:"true",
  COMMERCE_BOUNDED_OWNER_AUTHORIZED:"true",
  COMMERCE_LAUNCH_SAFETY_APPROVED:"true",
  COMMERCE_BOUNDED_INTEGRATION_ENABLED:"true",
  COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED:"true",
  COMMERCE_ENABLED:"true",
  NODE_ENV:"production",
  PAYMENT_PROVIDER:"mollie-live",
  FULFILMENT_MODE:"live",
  FULFILMENT_PROVIDER:"manual-live",
  COMMUNICATIONS_ENABLED:"true",
  COMMUNICATION_PROVIDER:"brevo",
  COMMUNICATIONS_LIVE_SEND_ENABLED:"true",
  BREVO_API_KEY:"synthetic-test-secret",
  TRANSACTIONAL_FROM_NAME:"Synthetic CYPH",
  TRANSACTIONAL_FROM_ADDRESS:"synthetic@example.invalid",
  TRANSACTIONAL_REPLY_TO_ADDRESS:"synthetic@example.invalid",
  HYPERDRIVE:{connectionString:"postgresql://synthetic-host.invalid/test"},
  COMMERCE_DB_ROLE:"expected_runtime_role",
  COMMERCE_HYPERDRIVE_TLS_REVIEWED:"true"
};
function mockPool(database_name="cyph1_commerce_production",role_name="expected_runtime_role") {
  let ended=0, queries=0, provided;
  return {factory(config){provided=config;return {
    async query(){queries++;return {rows:[{database_name,role_name}]};},
    async end(){ended++;}
  };},stats(){return {ended,queries,provided};}};
}
test("TLS review gate prevents connection", async()=>{
  const m=mockPool();
  const result=await runIntegratedBoundedOnce({...ready,COMMERCE_HYPERDRIVE_TLS_REVIEWED:"false"},m.factory);
  assert.equal(result.status,"disabled");assert.equal(m.stats().queries,0);
});
test("wrong database refuses tasks and always closes pool", async()=>{
  const m=mockPool("cyph1_commerce_development");
  const result=await runIntegratedBoundedOnce(ready,m.factory);
  assert.equal(result.status,"database_mismatch");assert.equal(m.stats().ended,1);
  assert.equal(m.stats().queries,1);
  assert.equal(m.stats().provided.max,2);
  assert.equal(m.stats().provided.lock_timeout,2000);
});
test("unexpected database principal refuses and closes pool", async()=>{
  const m=mockPool("cyph1_commerce_production","unexpected_role");
  const result=await runIntegratedBoundedOnce(ready,m.factory);
  assert.equal(result.status,"role_mismatch");assert.equal(m.stats().ended,1);
});
test("database query failure closes pool without executing a consumer",async()=>{
  let ended=0;
  const factory=()=>({async query(){throw Error("synthetic database error")},async end(){ended++}});
  await assert.rejects(runIntegratedBoundedOnce(ready,factory),/synthetic database error/);
  assert.equal(ended,1);
});
test("unconfigured expected role prevents any consumer from running",async()=>{
 const m=mockPool();
 const result=await runIntegratedBoundedOnce({...ready,COMMERCE_DB_ROLE:""},m.factory);
 assert.equal(result.status,"role_mismatch");assert.equal(m.stats().ended,1);
});
