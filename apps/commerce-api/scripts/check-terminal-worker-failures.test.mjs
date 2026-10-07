import test from "node:test";
import assert from "node:assert/strict";
import { formatTerminalFailureSummary, terminalFailureSummary, monitorDatabaseTls } from "./check-terminal-worker-failures.mjs";

test("zero terminal failures emits only aggregate zero counts",()=>{
  assert.deepEqual(formatTerminalFailureSummary({fulfilmentCount:0,communicationCount:0}),[
    "Fulfilment terminal failures: 0","Communication terminal failures: 0"
  ]);
});
test("failure summary exposes counts and age but no identifiers",()=>{
  const lines=formatTerminalFailureSummary({fulfilmentCount:1,communicationCount:2,oldestCreatedAt:new Date("2026-09-22T12:00:00Z")},new Date("2026-09-22T12:12:00Z"));
  assert.deepEqual(lines,["Fulfilment terminal failures: 1","Communication terminal failures: 2","Oldest outstanding failure age: 12 minutes"]);
});

test("monitor detects explicit exhausted failures and uncertain sends, not only retry_exhausted",async()=>{
 let query="";const pool={query:async sql=>{query=sql;return {rows:[{fulfilment_count:1,communication_count:2,oldest_created_at:null}]};}};
 assert.deepEqual(await terminalFailureSummary(pool),{fulfilmentCount:1,communicationCount:2,oldestCreatedAt:undefined});
 assert.match(query,/attempt_count >= 3/);assert.match(query,/terminal_failure/);assert.match(query,/status='manual_review'/);
});
test("monitor enforces verified production TLS and rejects connection-string overrides",()=>{
 const env={NODE_ENV:"production",DATABASE_URL:"postgresql://synthetic@localhost/test",DATABASE_SSL:"true"};
 assert.deepEqual(monitorDatabaseTls(env),{rejectUnauthorized:true});
 for(const change of [{DATABASE_SSL:"false"},{DATABASE_SSL:undefined},{DATABASE_SSL:"yes"},{DATABASE_URL:env.DATABASE_URL+"?sslmode=no-verify"}])assert.throws(()=>monitorDatabaseTls({...env,...change}));
});

test("real PostgreSQL monitor detects explicit final failures, permanent rejections and manual review",{skip:!process.env.MANUAL_DISPATCH_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import("pg");const {randomUUID}=await import("node:crypto");
 const value=process.env.MANUAL_DISPATCH_TEST_DATABASE_URL;const url=new URL(value);
 assert.ok(["localhost","127.0.0.1"].includes(url.hostname)&&url.pathname.endsWith("_dispatch_test")&&!url.search&&process.env.NODE_ENV!=="production");
 const schema="monitor_"+randomUUID().replaceAll("-","");const admin=new pg.Pool({connectionString:value});await admin.query(`CREATE SCHEMA "${schema}"`);
 const pool=new pg.Pool({connectionString:value,options:`-c search_path=${schema},public`});
 try {
  await pool.query("CREATE TABLE outbox_events(aggregate_type text,event_type text,processing_status text,last_error_code text,attempt_count integer,created_at timestamptz DEFAULT now()); CREATE TABLE communication_deliveries(status text,last_error_code text,attempt_count integer,terminal_failure boolean DEFAULT false,created_at timestamptz DEFAULT now())");
  await pool.query("INSERT INTO outbox_events(aggregate_type,event_type,processing_status,last_error_code,attempt_count) VALUES('payment','payment.paid','failed','provider_error',3)");
  await pool.query("INSERT INTO communication_deliveries(status,last_error_code,attempt_count,terminal_failure) VALUES('failed','provider_error',3,false),('manual_review','send_uncertain',1,false),('failed','provider_rejected',1,true),('failed','retryable',1,false)");
  const result=await terminalFailureSummary(pool);assert.equal(result.fulfilmentCount,1);assert.equal(result.communicationCount,3);
 } finally {await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
