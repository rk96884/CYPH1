import test from "node:test";
import assert from "node:assert/strict";
import {approvedForBoundedRun,runIntegratedBoundedOnce} from "./src/bounded-commerce-tasks.mjs";
const gates={COMMERCE_BOUNDED_WORKER_ENABLED:"true",COMMERCE_BOUNDED_OWNER_AUTHORIZED:"true",COMMERCE_LAUNCH_SAFETY_APPROVED:"true",COMMERCE_BOUNDED_INTEGRATION_ENABLED:"true",COMMERCE_BOUNDED_COMMUNICATIONS_ENABLED:"true"};
test("default and incomplete launch controls never create a pool",async()=>{
 let created=0;
 const factory=()=>{created++;throw Error("must not connect")};
 assert.equal(approvedForBoundedRun({}),false);
 for(const key of Object.keys(gates)){const flags={...gates};delete flags[key];assert.equal((await runIntegratedBoundedOnce(flags,factory)).status,"disabled");}
 assert.equal((await runIntegratedBoundedOnce(gates,factory)).status,"disabled");
 assert.equal(created,0);
});
test("no Hyperdrive binding or disabled commerce cannot connect",async()=>{
 let created=0;const factory=()=>{created++;throw Error("must not connect")};
 assert.equal((await runIntegratedBoundedOnce({...gates,NODE_ENV:"production",COMMERCE_ENABLED:"true"},factory)).status,"disabled");
 assert.equal(created,0);
});
test("integrated production adapter exports only required explicit gates",()=> {
 assert.equal(approvedForBoundedRun({...gates}),true);
 assert.equal(approvedForBoundedRun({...gates,COMMERCE_BOUNDED_INTEGRATION_ENABLED:"false"}),false);
});
