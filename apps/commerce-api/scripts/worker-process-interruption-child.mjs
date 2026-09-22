import process from "node:process";
import pg from "pg";
const { Client } = pg;

const [eventId, markerPath] = process.argv.slice(2);
if (!eventId || !markerPath) throw new Error("Worker child requires event id and marker path.");
const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required.");
const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
await client.connect();
try {
  await client.query("BEGIN");
  const claimed = await client.query(`
    SELECT id,event_key FROM outbox_events
     WHERE id=$1 AND aggregate_type='payment' AND event_type='payment.paid'
       AND (processing_status='pending' OR
         (processing_status='processing' AND attempt_count<3
          AND processing_started_at<=now()-(30*interval '1 second')))
       AND available_at<=now()
     FOR UPDATE SKIP LOCKED`, [eventId]);
  if (claimed.rowCount !== 1) throw new Error("Synthetic event was not claimable.");
  await client.query("UPDATE outbox_events SET processing_status='processing',attempt_count=attempt_count+1,processing_started_at=now(),last_error_code=NULL WHERE id=$1",[eventId]);
  await client.query("COMMIT");
  await import("node:fs/promises").then(({writeFile})=>writeFile(markerPath, JSON.stringify({ eventId, eventKey: claimed.rows[0].event_key, pid: process.pid })));
  console.log("CLAIMED");
  await new Promise(()=>{});
} finally { await client.end().catch(()=>undefined); }
