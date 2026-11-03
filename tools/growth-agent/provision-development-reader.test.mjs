import test from "node:test";
import assert from "node:assert/strict";
import { verifyProvisionInputs,validateBaseline,verifyReader,provisionReader } from "./provision-development-reader.mjs";

const env={ACTION:"apply",CONFIRMATION:"CREATE-DEVELOPMENT-GROWTH-READER",
  DATABASE_URL:"postgresql://owner:placeholder@db.example.org/cyph1_commerce_development",
  DATABASE_SSL:"true",GROWTH_READ_ROLE_PASSWORD:"x".repeat(48)};
const privileges={rolcanlogin:true,rolsuper:false,rolcreaterole:false,rolcreatedb:false,
  rolreplication:false,rolbypassrls:false,schema_read:true,prospects_read:true,evidence_read:true,
  prospects_write:false,research_runs_any:false,audit_any:false,outreach_any:false,
  suppression_any:false,commerce_orders:false,commerce_customers:false,commerce_payments:false};

test("reader role apply requires confirmation, strong independent secret and TLS",()=>{
  assert.doesNotThrow(()=>verifyProvisionInputs(env));
  assert.doesNotThrow(()=>verifyProvisionInputs({...env,ACTION:"plan",CONFIRMATION:"",GROWTH_READ_ROLE_PASSWORD:undefined}));
  assert.throws(()=>verifyProvisionInputs({...env,CONFIRMATION:"bad"}),/Confirmation/);
  assert.throws(()=>verifyProvisionInputs({...env,GROWTH_READ_ROLE_PASSWORD:"short"}),/secret/);
  assert.throws(()=>verifyProvisionInputs({...env,DATABASE_SSL:"false"}),/TLS/);
});

test("preflight rejects production and existing reader account",async()=>{
  const baseline=async sql=>{
    if(sql.includes("current_database()"))return {rows:[{db:"cyph1_commerce_development",actor:"cyph1_commerce_development_user"}]};
    if(sql.includes("schema_migrations"))return {rows:[{n:1}]};
    if(sql.includes("pg_catalog.pg_tables"))return {rows:[{n:6}]};
    if(sql.includes("FROM pg_roles"))return {rows:[]};
    throw Error("Unexpected query");
  };
  await validateBaseline(baseline);
  await assert.rejects(validateBaseline(async sql=>sql.includes("current_database()")?{rows:[{db:"cyph1_commerce_production"}]}:baseline(sql)),/Unexpected/);
  await assert.rejects(validateBaseline(async sql=>sql.includes("FROM pg_roles")?{rows:[{rolname:"growth_read_dev"}]}:baseline(sql)),/already exists/);
});

test("reader role grants exactly approved select access and commits after validation",async()=>{
  const sql=[];
  const client={query:async statement=>{
    sql.push(statement);
    if(statement.includes("FROM pg_roles r"))return {rows:[privileges]};
    return {rows:[]};
  }};
  await provisionReader(client,"x".repeat(48));
  assert.equal(sql[0],"BEGIN");
  assert.equal(sql.at(-1),"COMMIT");
  assert.ok(sql.some(q=>q==="GRANT SELECT ON growth.prospects, growth.prospect_evidence TO growth_read_dev"));
  assert.ok(!sql.some(q=>/^GRANT (INSERT|UPDATE|DELETE|ALL)/.test(q)));
  assert.ok(sql.indexOf("COMMIT")>sql.findIndex(q=>q.includes("FROM pg_roles r")));
});

test("unsafe privileges abort account creation transaction",async()=>{
  const sql=[];
  const client={query:async statement=>{
    sql.push(statement);
    if(statement.includes("FROM pg_roles r"))return {rows:[{...privileges,commerce_orders:true}]};
    return {rows:[]};
  }};
  await assert.rejects(provisionReader(client,"x".repeat(48)),/rolled back/);
  assert.equal(sql.at(-1),"ROLLBACK");
  assert.ok(!sql.includes("COMMIT"));
});
