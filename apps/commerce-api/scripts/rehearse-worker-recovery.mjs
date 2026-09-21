import process from "node:process";
import pg from "pg";
const { Client } = pg;
const retryLimit=3, leaseSeconds=30;
const config=()=>{
 if(process.env.ALLOW_WORKER_RECOVERY_REHEARSAL!=="true"||process.env.WORKER_RECOVERY_REHEARSAL_CONFIRM!=="synthetic-worker-recovery")throw new Error("Worker recovery rehearsal requires both explicit rehearsal guards.");
 if(process.env.NODE_ENV==="production")throw new Error("Worker recovery rehearsal is disabled in production.");
 const value=process.env.DATABASE_URL?.trim(); if(!value)throw new Error("DATABASE_URL is required.");
 let url; try{url=new URL(value)}catch{throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");}
 const database=decodeURIComponent(url.pathname.slice(1));
 if(!/(development|staging|test|restore|recovery)/i.test(database))throw new Error("Refusing worker recovery rehearsal against a database not explicitly named development, staging, test, restore or recovery.");
 return {connectionString:value,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:true}:false};
};
const check=(row,expected,label)=>{for(const [key,value] of Object.entries(expected))if(String(row?.[key])!==String(value))throw new Error(`${label}: expected ${key}=${value}, got ${row?.[key]}`);};
const stale=(client,table,id)=>client.query(`UPDATE ${table} SET processing_started_at=now()-interval '31 seconds' WHERE id=$1`,[id]);
const claimOutbox=async(client,id)=>{
 await client.query(`UPDATE outbox_events SET processing_status='failed',last_error_code='retry_exhausted',processing_started_at=NULL WHERE id=$1 AND processing_status='processing' AND attempt_count >= $2 AND processing_started_at<=now()-($3*interval '1 second')`,[id,retryLimit,leaseSeconds]);
 return (await client.query(`UPDATE outbox_events SET processing_status='processing',attempt_count=attempt_count+1,processing_started_at=now(),last_error_code=NULL WHERE id=$1 AND (processing_status='pending' OR (processing_status='failed' AND attempt_count<$2) OR (processing_status='processing' AND attempt_count<$2 AND processing_started_at<=now()-($3*interval '1 second'))) AND available_at<=now() RETURNING processing_status,attempt_count,last_error_code,processing_started_at`,[id,retryLimit,leaseSeconds])).rows[0];
};
const claimCommunication=async(client,id)=>{
 await client.query(`UPDATE communication_deliveries SET status='failed',last_error_code='retry_exhausted',processing_started_at=NULL,updated_at=now() WHERE id=$1 AND status='processing' AND attempt_count >= $2 AND processing_started_at<=now()-($3*interval '1 second')`,[id,retryLimit,leaseSeconds]);
 return (await client.query(`UPDATE communication_deliveries SET status='processing',attempt_count=attempt_count+1,processing_started_at=now(),last_error_code=NULL,updated_at=now() WHERE id=$1 AND (status='pending' OR (status='failed' AND attempt_count<$2) OR (status='processing' AND attempt_count<$2 AND processing_started_at<=now()-($3*interval '1 second'))) AND available_at<=now() RETURNING status,attempt_count,last_error_code,processing_started_at`,[id,retryLimit,leaseSeconds])).rows[0];
};
const client=new Client(config()); await client.connect();
try{
 await client.query("BEGIN");
 const ids=(await client.query("SELECT gen_random_uuid() event_id,gen_random_uuid() communication_id,gen_random_uuid() order_id,gen_random_uuid() customer_id")).rows[0];
 await client.query("INSERT INTO customers(id,email_normalised,email_display) VALUES($1,$2,$2)",[ids.customer_id,`worker-${ids.customer_id}@example.test`]);
 await client.query("INSERT INTO orders(id,order_number,customer_id,status,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES($1,$2,$3,'paid','GBP',100,100,'{}'::jsonb)",[ids.order_id,`CYPH1-WORKER-${String(ids.order_id).slice(0,8)}`,ids.customer_id]);
 await client.query("INSERT INTO outbox_events(id,event_key,event_type,aggregate_type,aggregate_id,payload) VALUES($1,$2,'payment.paid','payment',$3,jsonb_build_object('orderId',$3::text))",[ids.event_id,`worker-recovery:${ids.event_id}`,ids.order_id]);
 await client.query("INSERT INTO communication_deliveries(id,source_event_id,order_id,customer_id,template_key,deduplication_key,status) VALUES($1,$2,$3,$4,'order-confirmation',$5,'pending')",[ids.communication_id,ids.event_id,ids.order_id,ids.customer_id,`worker-recovery:${ids.communication_id}`]);
 let f=await claimOutbox(client,ids.event_id);check(f,{processing_status:"processing",attempt_count:1},"fulfilment first claim");
 if(await claimOutbox(client,ids.event_id))throw new Error("Fulfilment was reclaimed before lease expiry.");
 await stale(client,"outbox_events",ids.event_id);f=await claimOutbox(client,ids.event_id);check(f,{processing_status:"processing",attempt_count:2},"fulfilment second claim");
 await stale(client,"outbox_events",ids.event_id);f=await claimOutbox(client,ids.event_id);check(f,{processing_status:"processing",attempt_count:3},"fulfilment third claim");
 await stale(client,"outbox_events",ids.event_id);if(await claimOutbox(client,ids.event_id))throw new Error("Fulfilment was reclaimed after exhaustion.");
 f=(await client.query("SELECT processing_status,attempt_count,last_error_code,processing_started_at FROM outbox_events WHERE id=$1",[ids.event_id])).rows[0];check(f,{processing_status:"failed",attempt_count:3,last_error_code:"retry_exhausted",processing_started_at:null},"fulfilment exhaustion");
 let c=await claimCommunication(client,ids.communication_id);check(c,{status:"processing",attempt_count:1},"communication first claim");
 if(await claimCommunication(client,ids.communication_id))throw new Error("Communication was reclaimed before lease expiry.");
 await stale(client,"communication_deliveries",ids.communication_id);c=await claimCommunication(client,ids.communication_id);check(c,{status:"processing",attempt_count:2},"communication second claim");
 await stale(client,"communication_deliveries",ids.communication_id);c=await claimCommunication(client,ids.communication_id);check(c,{status:"processing",attempt_count:3},"communication third claim");
 await stale(client,"communication_deliveries",ids.communication_id);if(await claimCommunication(client,ids.communication_id))throw new Error("Communication was reclaimed after exhaustion.");
 c=(await client.query("SELECT status,attempt_count,last_error_code,processing_started_at FROM communication_deliveries WHERE id=$1",[ids.communication_id])).rows[0];check(c,{status:"failed",attempt_count:3,last_error_code:"retry_exhausted",processing_started_at:null},"communication exhaustion");
 console.log("Verified fulfilment lease protection, stale-claim recovery and terminal retry exhaustion at 3 attempts.");
 console.log("Verified communication lease protection, stale-claim recovery and terminal retry exhaustion at 3 attempts.");
 console.log("Worker recovery rehearsal passed; synthetic records rolled back.");
 await client.query("ROLLBACK");
}catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{await client.end();}
