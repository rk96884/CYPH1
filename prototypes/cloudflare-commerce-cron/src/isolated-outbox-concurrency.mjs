import pg from "pg";
import {randomUUID} from "node:crypto";

/**
 * Explicit development-only real PostgreSQL test; no commerce tables are read
 * or modified. Uses a uniquely named disposable schema and cleanup in finally.
 * Inject connection string through a local environment variable, never commit it.
 */
export async function runIsolatedOutboxConcurrency(connectionString, poolFactory=opts=>new pg.Pool(opts)) {
  if (!connectionString) throw new Error("Development connection string required");
  const pool=poolFactory({connectionString,max:3,connectionTimeoutMillis:3000,query_timeout:7000,statement_timeout:7000});
  const schema="cyph1_outbox_test_"+randomUUID().replaceAll("-","").slice(0,20);
  const table='"'+schema+'".events';
  let created=false;
  try {
    const identity=await pool.query("SELECT current_database() AS db");
    if(identity.rows[0]?.db!=="cyph1_commerce_development") throw new Error("Development database only");
    await pool.query('CREATE SCHEMA "'+schema+'"');
    created=true;
    await pool.query('CREATE TABLE '+table+" (id integer PRIMARY KEY, processing_status text NOT NULL DEFAULT 'pending', attempt_count integer NOT NULL DEFAULT 0, processing_started_at timestamptz, claim_token uuid, available_at timestamptz NOT NULL DEFAULT now())");
    await pool.query('INSERT INTO '+table+'(id) VALUES (1),(2)');
    const a=await pool.connect(), b=await pool.connect();
    let locked=false,skipped=false;
    try {
      await a.query("BEGIN");
      await b.query("BEGIN");
      const first=await a.query('SELECT id FROM '+table+" WHERE processing_status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1");
      const second=await b.query('SELECT id FROM '+table+" WHERE processing_status='pending' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1");
      locked=first.rows.length===1&&second.rows.length===1;
      skipped=locked&&first.rows[0].id!==second.rows[0].id;
    } finally {
      await a.query("ROLLBACK").finally(()=>a.release());
      await b.query("ROLLBACK").finally(()=>b.release());
    }
    if(!skipped)throw new Error("Concurrent claims failed");
    const oldToken=randomUUID(),newToken=randomUUID();
    await pool.query('UPDATE '+table+" SET processing_status='processing',claim_token=$1,attempt_count=1,processing_started_at=now()-interval '10 minutes' WHERE id=1",[oldToken]);
    await pool.query('UPDATE '+table+" SET claim_token=$1, attempt_count=attempt_count+1, processing_started_at=now() WHERE id=1 AND processing_started_at < now()-interval '5 minutes'",[newToken]);
    const stale=await pool.query('UPDATE '+table+" SET processing_status='published' WHERE id=1 AND processing_status='processing' AND claim_token=$1",[oldToken]);
    const current=await pool.query('UPDATE '+table+" SET processing_status='published',claim_token=NULL WHERE id=1 AND processing_status='processing' AND claim_token=$1",[newToken]);
    const recovery=stale.rowCount===0&&current.rowCount===1;
    await pool.query('UPDATE '+table+" SET processing_status='processing',attempt_count=3,processing_started_at=now()-interval '10 minutes' WHERE id=2");
    await pool.query('UPDATE '+table+" SET processing_status='failed',claim_token=NULL WHERE id=2 AND processing_status='processing' AND attempt_count>=3 AND processing_started_at < now()-interval '5 minutes'");
    const exhausted=await pool.query('SELECT id FROM '+table+" WHERE id=2 AND ((processing_status='failed' AND attempt_count<3) OR processing_status='pending')");
    const retryLimit=exhausted.rowCount===0;
    if(!recovery||!retryLimit)throw new Error("Claim/retry invariant failed");
    return {status:"verified",independentLocks:locked,skipLocked:skipped,staleCompletionBlocked:recovery,retryExhaustion:retryLimit};
  } finally {
    if(created)await pool.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
    await pool.end();
  }
}
