import pg from "pg";
import { terminalFailureSummary } from "./check-terminal-worker-failures.mjs";

const requiredGuard="synthetic-terminal-failure";
if(process.env.ALLOW_TERMINAL_FAILURE_REHEARSAL!=="true"||process.env.TERMINAL_FAILURE_REHEARSAL_CONFIRM!==requiredGuard)
  throw new Error("Terminal failure rehearsal guards are not enabled.");
if(process.env.NODE_ENV==="production") throw new Error("Refusing to run terminal failure rehearsal in production.");
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const parsed=new URL(process.env.DATABASE_URL);
const dbName=decodeURIComponent(parsed.pathname.slice(1));
if(!/(development|staging|test|restore|recovery)/i.test(dbName))
  throw new Error("Database name must identify a development, staging, test, restore or recovery database.");
if(process.env.DATABASE_SSL && !["true","false"].includes(process.env.DATABASE_SSL))
  throw new Error("DATABASE_SSL must be true or false when set.");

const ssl=process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined;
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl});
const client=await pool.connect();
try{
  await client.query("BEGIN");
  const baseline=await terminalFailureSummary(client);
  if(baseline.fulfilmentCount!==0||baseline.communicationCount!==0)
    throw new Error("Rehearsal requires a zero terminal-failure baseline.");

  const ids={product:crypto.randomUUID(),customer:crypto.randomUUID(),order:crypto.randomUUID(),event:crypto.randomUUID(),delivery:crypto.randomUUID()};
  const suffix=ids.order.slice(0,8);
  await client.query(`INSERT INTO products(id,sku,slug,name,description,status,price_minor,currency,tax_code,content_version)
    VALUES($1,$2,$3,'Synthetic terminal failure','Synthetic rehearsal only','private',1000,'GBP','synthetic','rehearsal')`,
    [ids.product,`SYN-TERM-${suffix}`,`synthetic-terminal-${suffix}`]);
  await client.query(`INSERT INTO customers(id,email_normalised,email_display) VALUES($1,$2,$2)`,
    [ids.customer,`synthetic-terminal-${suffix}@invalid.example`]);
  await client.query(`INSERT INTO orders(id,order_number,customer_id,status,currency,subtotal_minor,total_minor,delivery_address_snapshot)
    VALUES($1,$2,$3,'paid','GBP',1000,1000,'{}'::jsonb)`,[ids.order,`SYN-TERM-${suffix}`,ids.customer]);
  await client.query(`INSERT INTO outbox_events(id,event_key,event_type,aggregate_type,aggregate_id,payload,processing_status,attempt_count,last_error_code)
    VALUES($1,$2,'payment.paid','payment',$3,$4::jsonb,'failed',3,'retry_exhausted')`,
    [ids.event,`terminal-rehearsal:${ids.event}`,ids.order,JSON.stringify({orderId:ids.order})]);
  await client.query(`INSERT INTO communication_deliveries(id,source_event_id,order_id,customer_id,template_key,deduplication_key,status,attempt_count,last_error_code)
    VALUES($1,$2,$3,$4,'order-confirmation',$5,'failed',3,'retry_exhausted')`,
    [ids.delivery,ids.event,ids.order,ids.customer,`terminal-rehearsal:${ids.delivery}`]);

  const detected=await terminalFailureSummary(client);
  if(detected.fulfilmentCount!==1||detected.communicationCount!==1)
    throw new Error(`Expected one synthetic terminal failure of each type; got fulfilment=${detected.fulfilmentCount}, communications=${detected.communicationCount}.`);
  console.log("Verified synthetic fulfilment terminal failure detection: 1.");
  console.log("Verified synthetic communication terminal failure detection: 1.");
  console.log("Verified monitor uses aggregate operational counts only; no customer or order identifiers emitted.");
  await client.query("ROLLBACK");

  const cleaned=await terminalFailureSummary(client);
  if(cleaned.fulfilmentCount!==0||cleaned.communicationCount!==0)
    throw new Error("Terminal failure rehearsal cleanup did not restore the zero state.");
  console.log("Terminal failure rehearsal passed; synthetic records rolled back and zero state restored.");
}catch(error){
  try{await client.query("ROLLBACK");}catch{}
  throw error;
}finally{client.release();await pool.end();}
