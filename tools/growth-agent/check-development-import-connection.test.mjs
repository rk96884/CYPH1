import assert from "node:assert/strict";
import test from "node:test";
import { buildRestrictedUrl, verifyRestrictedConnection } from "./check-development-import-connection.mjs";

const owner = "postgresql://commerce_owner:fake@db.example.com:5432/cyph1_commerce_development?sslmode=require";
const secret = "abc@!:/#?%'" + "y".repeat(44);
const good = {
  growth_schema:true,prospects_read:true,prospects_insert:true,
  evidence_insert:true,runs_insert:true,audit_insert:true,
  customers_any:false,orders_any:false,payments_any:false,
  outreach_any:false,suppression_any:false
};
test("URL uses restricted login, encodes special characters and preserves exact development DB",()=>{
  const url = new URL(buildRestrictedUrl(owner,secret));
  assert.equal(decodeURIComponent(url.username),"growth_import_dev");
  assert.equal(decodeURIComponent(url.password),secret);
  assert.equal(url.pathname,"/cyph1_commerce_development");
  assert.equal(url.hostname,"db.example.com");
  assert.ok(!buildRestrictedUrl(owner,secret).includes("commerce_owner"));
  assert.throws(()=>buildRestrictedUrl(owner.replace("development","production"),secret),/development-only/i);
  assert.throws(()=>buildRestrictedUrl(owner,"short"),/missing or invalid/i);
});
test("connection confirms actual role, restricted permissions and read only count",async()=>{
  const queries=[];
  const count=await verifyRestrictedConnection(async sql=>{
    queries.push(sql);
    if(sql.includes("current_database()"))return {rows:[{name:"cyph1_commerce_development",role:"growth_import_dev"}]};
    if(sql.includes("has_schema_privilege"))return {rows:[good]};
    if(sql.includes("COUNT(*)"))return {rows:[{total:0}]};
    throw new Error("unexpected SQL");
  });
  assert.equal(count,0);
  assert.ok(queries.every(sql=>/^\s*SELECT\b/i.test(sql)));
});
test("fails closed if commerce data or outreach becomes accessible",async()=>{
  await assert.rejects(verifyRestrictedConnection(async sql=>{
    if(sql.includes("current_database()"))return {rows:[{name:"cyph1_commerce_development",role:"growth_import_dev"}]};
    return {rows:[{...good,orders_any:true}]};
  }),/permissions/);
});
test("rejects owner connection masquerading as importer",async()=>{
  await assert.rejects(verifyRestrictedConnection(async()=>({rows:[{name:"cyph1_commerce_development",role:"cyph1_commerce_development_user"}]})),/Unexpected/);
});
