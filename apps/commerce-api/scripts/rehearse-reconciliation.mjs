import pg from "pg";

const confirmation="synthetic-reconciliation";
if(process.env.ALLOW_RECONCILIATION_REHEARSAL!=="true"||process.env.RECONCILIATION_REHEARSAL_CONFIRM!==confirmation)
  throw new Error("Reconciliation rehearsal guards are not enabled.");
if(process.env.NODE_ENV==="production") throw new Error("Refusing to run reconciliation rehearsal in production.");
if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const dbName=decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
if(!/(development|staging|test|restore|recovery)/i.test(dbName)) throw new Error("Database name must identify a non-production environment.");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined});
const client=await pool.connect();
try{
  await client.query("BEGIN");
  const now=new Date(),from=new Date(now.getTime()-60000).toISOString(),to=new Date(now.getTime()+60000).toISOString();
  const customer=crypto.randomUUID(),ambiguousOrder=crypto.randomUUID(),emptyOrder=crypto.randomUUID(),payment=crypto.randomUUID(),refund=crypto.randomUUID();
  const suffix=ambiguousOrder.slice(0,8);
  await client.query("INSERT INTO customers(id,email_normalised,email_display) VALUES($1,$2,$2)",[customer,`synthetic-recon-${suffix}@invalid.example`]);
  await client.query(`INSERT INTO orders(id,order_number,customer_id,status,currency,subtotal_minor,total_minor,delivery_address_snapshot)
    VALUES($1,$2,$3,'draft','GBP',1000,1000,'{}'::jsonb),($4,$5,$3,'draft','GBP',500,500,'{}'::jsonb)`,
    [ambiguousOrder,`SYN-RECON-AMB-${suffix}`,customer,emptyOrder,`SYN-RECON-NOPAY-${suffix}`]);
  await client.query(`INSERT INTO checkout_sessions(idempotency_key,request_fingerprint,order_id,state,failure_code)
    VALUES($1,$2,$3,'resolution_required','ambiguous_provider_outcome')`,[`synthetic-recon-${suffix}`,"a".repeat(64),ambiguousOrder]);
  await client.query(`INSERT INTO payments(id,order_id,provider,provider_payment_id,status,amount_minor,currency,idempotency_key)
    VALUES($1,$2,'mollie-test',$3,'captured',1000,'GBP',$4)`,[payment,ambiguousOrder,`tr_synthetic_${suffix}`,`synthetic-payment-${suffix}`]);
  await client.query(`INSERT INTO refunds(id,payment_id,amount_minor,currency,reason,status,idempotency_key)
    VALUES($1,$2,700,'GBP','customer_request','resolution_required',$3)`,[refund,payment,`synthetic-refund-${suffix}`]);
  const result=await client.query(`SELECT o.order_number,cs.state AS checkout_state,cs.failure_code AS checkout_failure_code,p.provider_payment_id,p.status AS payment_status,
    COALESCE(ra.resolution_required_refund_minor,0)::bigint AS resolution_required_refund_minor
    FROM orders o LEFT JOIN checkout_sessions cs ON cs.order_id=o.id LEFT JOIN payments p ON p.order_id=o.id
    LEFT JOIN LATERAL (SELECT COALESCE(sum(r.amount_minor) FILTER (WHERE r.status='resolution_required'),0) AS resolution_required_refund_minor,
      bool_or(r.created_at >= $1::timestamptz AND r.created_at < $2::timestamptz) AS has_activity FROM refunds r WHERE r.payment_id=p.id) ra ON true
    WHERE ((o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz) OR (p.created_at >= $1::timestamptz AND p.created_at < $2::timestamptz) OR COALESCE(ra.has_activity,false))
      AND o.id IN ($3,$4) ORDER BY o.order_number`,[from,to,ambiguousOrder,emptyOrder]);
  if(result.rowCount!==2) throw new Error(`Expected 2 synthetic reconciliation rows; got ${result.rowCount}.`);
  const ambiguous=result.rows.find(r=>r.order_number.startsWith("SYN-RECON-AMB-")), noPayment=result.rows.find(r=>r.order_number.startsWith("SYN-RECON-NOPAY-"));
  if(!ambiguous||ambiguous.checkout_state!=="resolution_required"||ambiguous.checkout_failure_code!=="ambiguous_provider_outcome"||Number(ambiguous.resolution_required_refund_minor)!==700) throw new Error("Ambiguous state was not surfaced correctly.");
  if(!noPayment||noPayment.provider_payment_id!==null||noPayment.payment_status!==null) throw new Error("Order without provider payment was not surfaced correctly.");
  console.log("Verified checkout resolution_required with ambiguous_provider_outcome.");
  console.log("Verified resolution_required refund amount: 700 minor units.");
  console.log("Verified order with no provider payment remains visible.");
  console.log("Verified privacy-safe output: no customer identity emitted.");
  await client.query("ROLLBACK");
  const cleanup=await client.query("SELECT count(*)::int AS count FROM orders WHERE id IN ($1,$2)",[ambiguousOrder,emptyOrder]);
  if(cleanup.rows[0].count!==0) throw new Error("Rehearsal cleanup failed.");
  console.log("Reconciliation rehearsal passed; synthetic records rolled back.");
}catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();await pool.end();}
