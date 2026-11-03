import assert from "node:assert/strict";
import test from "node:test";
import {
  validateProvisioningInput, verifyDevelopmentBaseline, provisionGrowthRole,
  verifyRoleGrants, REQUIRED_TABLES, GrowthRoleStageError, quotePostgresPassword
} from "./provision-development-growth-role.mjs";

const secret = "test-only-" + "x".repeat(48);
const attrs = { rolcanlogin:true, rolcreatedb:false, rolcreaterole:false, rolsuper:false, rolreplication:false, rolbypassrls:false };
const grants = {
  growth_schema:true,prospects_read:true,prospects_insert:true,evidence_insert:true,
  runs_insert:true,audit_insert:true,audit_sequence:true,
  outreach_any:false,suppression_any:false,orders_any:false,payments_any:false,customers_any:false
};
const baseline = async sql => {
  if (sql.includes("current_database")) return { rows:[{ name:"cyph1_commerce_development", role:"owner" }] };
  if (sql.includes("schema_migrations")) return { rows:[{total:1}] };
  if (sql.includes("pg_catalog.pg_tables")) return { rows:REQUIRED_TABLES.map(tablename=>({tablename})) };
  if (sql.includes("has_schema_privilege('public'")) return { rows:[{usable:false}] };
  if (sql.includes("pg_catalog.pg_roles")) return { rows:[] };
  throw new Error("Unexpected query");
};
test("plan checks exact development identity, six tables, private schema and role absence",async()=>{
  await verifyDevelopmentBaseline(baseline);
  await assert.rejects(verifyDevelopmentBaseline(async sql=>sql.includes("current_database")?{rows:[{name:"cyph1_commerce_production"}]}:baseline(sql)),/Wrong database/);
  await assert.rejects(verifyDevelopmentBaseline(async sql=>sql.includes("pg_catalog.pg_roles")?{rows:[{rolname:"growth_import_dev"}]}:baseline(sql)),/already exists/);
});
test("apply needs deliberate confirmation and strong secret; plan does not",()=>{
  assert.doesNotThrow(()=>validateProvisioningInput({action:"plan"}));
  assert.throws(()=>validateProvisioningInput({action:"apply",password:secret}),/confirmation/);
  assert.throws(()=>validateProvisioningInput({action:"apply",confirmation:"CREATE-DEVELOPMENT-GROWTH-ROLE",password:"short"}),/password/);
  assert.doesNotThrow(()=>validateProvisioningInput({action:"apply",confirmation:"CREATE-DEVELOPMENT-GROWTH-ROLE",password:secret}));
});
test("provision grants only exact tables and verifies before commit",async()=>{
  const queries=[];
  const client={query:async(sql,args)=>{
    queries.push(sql);
    if (sql.includes("FROM pg_roles"))return {rows:[attrs]};
    if (sql.includes("has_schema_privilege('growth_import_dev'"))return {rows:[grants]};
    return {rows:[]};
  }};
  await provisionGrowthRole(client,secret);
  assert.equal(queries[0],"BEGIN");
  assert.equal(queries.at(-1),"COMMIT");
  assert.ok(queries.some(sql=>sql.startsWith("GRANT INSERT ON growth.audit_log")));
  assert.ok(!queries.some(sql=>/GRANT .+ ON (?:public\.|growth\.outreach_drafts|growth\.suppression_list)/.test(sql)));
  assert.ok(queries.indexOf("COMMIT")>queries.findIndex(sql=>sql.includes("has_schema_privilege('growth_import_dev'")));
});
test("unsafe privileges cause rollback; no committed role",async()=>{
  const queries=[];
  const client={query:async(sql,args)=>{
    queries.push(sql);
    if(sql.includes("FROM pg_roles"))return {rows:[attrs]};
    if(sql.includes("has_schema_privilege('growth_import_dev'"))return {rows:[{...grants,orders_any:true}]};
    return {rows:[]};
  }};
  await assert.rejects(provisionGrowthRole(client,secret),error => error instanceof GrowthRoleStageError && error.stage === "verify_permissions");
  assert.equal(queries.at(-1),"ROLLBACK");
  assert.ok(!queries.includes("COMMIT"));
});
test("post-grant privilege verifier rejects missing required rights",async()=>{
  await assert.rejects(verifyRoleGrants(async sql=>sql.includes("FROM pg_roles")?{rows:[attrs]}:{rows:[{...grants,prospects_insert:false}]}),/verification failed/);
});

test("role creation failure exposes only a safe stage identifier",async()=>{
  const statements=[];
  const client={query:async(sql)=>{
    statements.push(sql);
    if(sql.startsWith("CREATE ROLE"))throw new Error("synthetic private credential content");
    return {rows:[]};
  }};
  await assert.rejects(provisionGrowthRole(client,secret),error=>{
    assert.equal(error.stage,"create_role");
    assert.doesNotMatch(error.message,/private credential|PASSWORD|synthetic/);
    return true;
  });
  assert.equal(statements.at(-1),"ROLLBACK");
});

test("SQL password quoting escapes apostrophes and rejects control characters",()=>{
  assert.equal(quotePostgresPassword("a'b"), "'a''b'");
  assert.equal(quotePostgresPassword("abc\\def"), "'abc\\def'");
  assert.throws(()=>quotePostgresPassword("test\nsecret"),/Invalid password/);
  assert.throws(()=>quotePostgresPassword("test\u0000secret"),/Invalid password/);
});
test("creation statement is locally constructed without prepare query",async()=>{
  const queries=[];
  const client={query:async sql=>{
    queries.push(sql);
    if (sql.includes("FROM pg_roles")) return {rows:[attrs]};
    if (sql.includes("has_schema_privilege('growth_import_dev'")) return {rows:[grants]};
    return {rows:[]};
  }};
  await provisionGrowthRole(client,"a'b" + "z".repeat(35));
  assert.ok(queries.some(sql=>sql.includes("PASSWORD 'a''b")));
  assert.ok(!queries.some(sql=>sql.startsWith("SELECT format(")));
});
