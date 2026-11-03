import test from "node:test";
import { scryptSync } from "node:crypto";
import assert from "node:assert/strict";
import { validateDevelopmentApiEnvironment, validateReadOnlyDatabase,
  readDevelopmentProspects, createDevelopmentGrowthHandler, databaseStartupFailureCode, developmentDatabaseConnection, DEVELOPMENT_INTERNAL_DB_HOST } from "./development-read-api.mjs";

test("startup diagnostics classify failures without leaking raw error details",()=>{
  assert.equal(databaseStartupFailureCode({code:"28P01",message:"sensitive database error"}),"DB_AUTHENTICATION_FAILED");
  assert.equal(databaseStartupFailureCode({code:"SELF_SIGNED_CERT_IN_CHAIN"}),"DB_TLS_CERTIFICATE_INVALID");
  assert.equal(databaseStartupFailureCode({message:"Development read-only account validation failed"}),"DB_ROLE_BOUNDARY_INVALID");
  assert.equal(databaseStartupFailureCode({code:"sensitive",message:"postgresql://private"}),"DB_CONNECTION_OR_VALIDATION_FAILED");
});

const env={
  GROWTH_DATA_ENV:"development",
  GROWTH_DEV_READ_DATABASE_URL:"postgresql://growth_read_dev:placeholder123@dpg-da9hpq1srm7s73cdb260-a/cyph1_commerce_development",
  GROWTH_DEV_UI_ORIGIN:"http://localhost:4321",
  GROWTH_DEV_ADMIN_EMAIL:"rishikhosla@hotmail.com",
  GROWTH_DEV_PASSWORD_HASH:"scrypt:"+"07".repeat(16)+":"+scryptSync("a".repeat(64),Buffer.alloc(16,7),64).toString("hex")
};

test("development-only config rejects wrong database, writer role and production origins",()=>{
  const good=validateDevelopmentApiEnvironment(env);
  assert.equal(good.uiOrigin,"http://localhost:4321");
  assert.equal(good.auth.email,"rishikhosla@hotmail.com");
  assert.throws(()=>validateDevelopmentApiEnvironment({...env,GROWTH_DATA_ENV:"production"}),/Development-only/);
  assert.throws(()=>validateDevelopmentApiEnvironment({...env,GROWTH_DEV_READ_DATABASE_URL:env.GROWTH_DEV_READ_DATABASE_URL.replace("growth_read_dev","growth_import_dev")}),/growth_read_dev/);
  assert.throws(()=>validateDevelopmentApiEnvironment({...env,GROWTH_DEV_READ_DATABASE_URL:env.GROWTH_DEV_READ_DATABASE_URL.replace("development","production")}),/development/);
  assert.throws(()=>validateDevelopmentApiEnvironment({...env,GROWTH_DEV_UI_ORIGIN:"https://www.cyph1.co.uk"}),/Production website/);

});

test("database identity must be the dedicated reader with no write grants",async()=>{
  const pass={db:"cyph1_commerce_development",actor:"growth_read_dev",
    can_read:true,can_read_evidence:true,can_write:false,commerce:false,orders:false,outreach:false};
  await validateReadOnlyDatabase(async()=>({rows:[pass]}));
  await assert.rejects(validateReadOnlyDatabase(async()=>({rows:[{...pass,actor:"growth_import_dev"}]})),/validation failed/);
  await assert.rejects(validateReadOnlyDatabase(async()=>({rows:[{...pass,commerce:true}]})),/validation failed/);
});

test("untrusted requests cannot fetch or mutate research",async()=>{
  let calls=0;
  const handler=createDevelopmentGrowthHandler({
    uiOrigin:"https://preview.example.org",
    authenticate:async token=>token==="signed-test-token",
    readProspects:async()=>{calls++;return [{id:"test-id",name:"research-only"}]}
  });
  assert.equal((await handler({method:"GET",path:"/operations/growth/prospects"})).status,401);
  assert.equal((await handler({method:"POST",path:"/operations/growth/prospects",token:"signed-test-token"})).status,405);
  assert.equal((await handler({method:"GET",path:"/orders",token:"signed-test-token"})).status,404);
  assert.equal((await handler({method:"GET",path:"/operations/growth/prospects",token:"bad"})).status,401);
  assert.equal((await handler({method:"OPTIONS",path:"/operations/growth/prospects",origin:"https://untrusted.example.org"})).status,403);
  assert.equal(calls,0);
  const ok=await handler({method:"GET",path:"/operations/growth/prospects",token:"signed-test-token"});
  assert.equal(ok.status,200);
  assert.equal(ok.body.environment,"development");
  assert.equal(ok.body.readOnly,true);
  assert.equal(calls,1);
});

test("growth reader runs select-only bounded query with source evidence counts",async()=>{
  let sql="";
  const rows=await readDevelopmentProspects(async query=>{
    sql=query;
    return {rows:[{id:"id1",channel:"creator",display_name:"Creator",source_url:"https://example.org",
      source_checked_at:new Date("2026-11-03T12:00:00Z"),review_status:"research_only",
      qualification_score:24,qualification_confidence:0.2,evidence_count:1}]};
  });
  assert.match(sql,/^\s*SELECT/);
  assert.match(sql,/LIMIT 100/);
  assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE/i);
  assert.equal(rows[0].evidenceCount,1);
  assert.equal(rows[0].status,"research_only");
});

test("self-signed TLS exception only applies to exact private Render development database",()=>{
  const valid=env.GROWTH_DEV_READ_DATABASE_URL;
  const connection=developmentDatabaseConnection(valid);
  assert.equal(connection.ssl.rejectUnauthorized,false);
  assert.equal(connection.max,3);
  assert.match(connection.options,/default_transaction_read_only=on/);
  assert.equal(new URL(valid).hostname,DEVELOPMENT_INTERNAL_DB_HOST);
  for(const invalid of [
    valid.replace(DEVELOPMENT_INTERNAL_DB_HOST,"db.example.org"),
    valid.replace(DEVELOPMENT_INTERNAL_DB_HOST,DEVELOPMENT_INTERNAL_DB_HOST+".evil.example"),
    valid.replace(DEVELOPMENT_INTERNAL_DB_HOST,DEVELOPMENT_INTERNAL_DB_HOST+".frankfurt-postgres.render.com"),
    valid.replace(DEVELOPMENT_INTERNAL_DB_HOST,"127.0.0.1"),
    valid.replace("growth_read_dev","growth_import_dev"),
    valid.replace("cyph1_commerce_development","cyph1_commerce_production"),
    valid.replace("postgresql:","http:"),
    valid.replace("/cyph1_commerce_development","/cyph1_commerce_development?sslmode=disable"),
    valid.replace("/cyph1_commerce_development","/cyph1_commerce_development#fragment"),
    valid.replace(DEVELOPMENT_INTERNAL_DB_HOST,DEVELOPMENT_INTERNAL_DB_HOST+":5433")
  ]){
    assert.throws(()=>developmentDatabaseConnection(invalid),/Dedicated Render internal/);
  }
  assert.throws(()=>developmentDatabaseConnection("not-a-url"),/Invalid development database URL/);
});
