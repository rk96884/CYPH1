import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script=fileURLToPath(new URL("./prepare-production-international-shipping.mjs",import.meta.url));
const invoke=(args=[],env={})=>spawnSync(process.execPath,[script,...args],{
  env:{PATH:process.env.PATH,NODE_ENV:"test",...env},
  encoding:"utf8",
  timeout:10000,
});
test("international production plan is read-only, uses six commercial groups and excludes USA",()=>{
  const result=invoke();
  assert.equal(result.status,0,result.stderr);
  const plan=JSON.parse(result.stdout);
  assert.equal(plan.databaseConnected,false);
  assert.equal(plan.usa,"excluded");
  assert.equal(plan.existingUk,"unchanged");
  assert.equal(plan.newZones.length,2);
  assert.equal(plan.destinations.length,31);
  assert.ok(plan.destinations.every(d=>d.status==="disabled" && d.countryCode!=="US"));
  assert.ok(plan.destinations.some(d=>d.group==="latam" && d.minor===2599));
  assert.ok(plan.destinations.some(d=>d.group==="apac" && d.minor===2599));
  assert.ok(plan.destinations.some(d=>d.group==="europe" && d.minor===1499));
  assert.ok(plan.destinations.some(d=>d.group==="middle-east" && d.minor===2599));
  assert.ok(plan.destinations.some(d=>d.group==="rest-of-world" && d.minor===2599));
  for (const code of ["PK","KZ","UZ","KG","TJ"]) assert.ok(plan.destinations.some(d=>d.countryCode===code && d.group==="apac" && d.minor===2599 && d.status==="disabled"));
  assert.ok(plan.destinations.some(d=>d.countryCode==="AU" && d.group==="apac"));
  assert.ok(plan.destinations.some(d=>d.countryCode==="NZ" && d.group==="apac"));
  assert.ok(!plan.destinations.some(d=>["AU","NZ"].includes(d.countryCode) && d.group==="rest-of-world"));
});
test("production international apply refuses missing gates without database access",()=>{
  const result=invoke(["--apply"],{DATABASE_URL:"postgres://user:secret@localhost/cyph1_commerce_production"});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/safe gates are required/);
  assert.doesNotMatch(result.stdout,/secret/);
});
test("production international apply rejects wrong database identity before connecting",()=>{
  const result=invoke(["--apply"],{
    NODE_ENV:"production",SHIPPING_PRODUCTION_CONFIRM:"create-disabled-international-only",
    COMMERCE_ENABLED:"false",CHECKOUT_HTTP_ENABLED:"false",PAYMENT_WEBHOOKS_ENABLED:"false",
    PAYMENT_PROVIDER:"disabled",FULFILMENT_MODE:"disabled",FULFILMENT_PROVIDER:"disabled",
    DATABASE_URL:"postgres://user:secret@localhost/cyph1_commerce_development",
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/non-allowlisted production database/);
});
test("production international setup rejects unexpected command-line switches",()=>{
  const result=invoke(["--activate"]);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Only --apply is supported/);
});
