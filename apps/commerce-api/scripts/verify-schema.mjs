import process from "node:process";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});

const expectConstraintFailure = async (name, sql, parameters = []) => {
  const savepoint = `verify_${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql, parameters);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (error && typeof error === "object" && "code" in error && String(error.code).startsWith("23")) {
      console.log(`Verified constraint: ${name}`);
      return;
    }
    throw error;
  }
  throw new Error(`Expected database constraint to reject: ${name}`);
};

await client.connect();
try {
  const expectedTables = [
    "returns", "return_items", "products", "inventory_levels", "customers", "customer_consents", "addresses",
    "shipping_zones", "shipping_zone_countries", "shipping_methods", "shipping_rates",
    "orders", "order_items", "payments", "refunds", "webhook_deliveries", "webhook_events", "fulfilments",
    "outbox_events", "checkout_sessions", "fulfilment_events", "operator_commands", "communication_deliveries", "audit_events", "schema_migrations",
  ];
  const tableResult = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
    [expectedTables],
  );
  const found = new Set(tableResult.rows.map((row) => row.tablename));
  const missing = expectedTables.filter((table) => !found.has(table));
  if (missing.length > 0) throw new Error(`Missing database tables: ${missing.join(", ")}`);
  console.log(`Verified ${expectedTables.length} required tables.`);

  const leaseColumns = await client.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND (table_name,column_name) IN
      (('outbox_events','processing_started_at'),('communication_deliveries','processing_started_at'))`);
  if (leaseColumns.rowCount !== 2) throw new Error("Missing worker claim lease columns.");
  console.log("Verified worker claim lease columns.");
  const sendSafetyColumns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='communication_deliveries'
    AND column_name IN ('claim_token','send_started_at','terminal_failure')`);
  if (sendSafetyColumns.rowCount !== 3) throw new Error("Missing communication send-safety columns.");
  console.log("Verified communication send-safety columns.");


  await client.query("BEGIN");
  await expectConstraintFailure(
    "lowercase currency",
    `INSERT INTO products
      (sku, slug, name, description, status, price_minor, currency, tax_code, content_version)
     VALUES ('VERIFY-INVALID', 'verify-invalid', 'Invalid', 'Invalid', 'private', 0, 'gbp', 'TEST', 'verify')`,
  );

  const product = await client.query(
    `INSERT INTO products
      (sku, slug, name, description, status, price_minor, currency, tax_code, shipping_weight_grams, content_version)
     VALUES ('VERIFY-PRODUCT', 'verify-product', 'Verification product', 'Rolled back', 'private', 1000, 'GBP', 'TEST', 100, 'verify')
     RETURNING id`,
  );

  await expectConstraintFailure(
    "incorrect order total",
    `INSERT INTO orders
      (order_number, currency, subtotal_minor, discount_minor, tax_minor, delivery_minor, total_minor, delivery_address_snapshot)
     VALUES ('VERIFY-BAD-TOTAL', 'GBP', 1000, 0, 200, 0, 999, '{}'::jsonb)`,
  );

  const order = await client.query(
    `INSERT INTO orders
      (order_number, currency, subtotal_minor, discount_minor, tax_minor, delivery_minor, total_minor, delivery_address_snapshot)
     VALUES ('VERIFY-ORDER', 'GBP', 1000, 0, 200, 0, 1200, '{}'::jsonb)
     RETURNING id`,
  );

  await expectConstraintFailure(
    "non-positive item quantity",
    `INSERT INTO order_items
      (order_id, product_id, sku_snapshot, name_snapshot, unit_price_minor, unit_weight_grams, quantity, tax_minor, line_total_minor)
     VALUES ($1, $2, 'VERIFY-PRODUCT', 'Verification product', 1000, 100, 0, 0, 0)`,
    [order.rows[0].id, product.rows[0].id],
  );

  await expectConstraintFailure(
    "invalid checkout fingerprint",
    `INSERT INTO checkout_sessions (idempotency_key, request_fingerprint)
     VALUES ('verify-invalid-fingerprint', 'not-a-sha256-fingerprint')`,
  );

  const merchandiseReturn = await client.query(`INSERT INTO returns(order_id,request_category,currency)
    VALUES($1,'fault_reported','GBP') RETURNING id`, [order.rows[0].id]);
  await expectConstraintFailure("uncontrolled return category", `INSERT INTO returns(order_id,request_category,currency)
    VALUES($1,'customer narrative','GBP')`, [order.rows[0].id]);
  await expectConstraintFailure("negative return decision", "UPDATE returns SET approved_refund_minor=-1 WHERE id=$1", [merchandiseReturn.rows[0].id]);
  await expectConstraintFailure("receipt waiver must be explicit", "UPDATE returns SET receipt_required=false WHERE id=$1", [merchandiseReturn.rows[0].id]);
  await expectConstraintFailure("inspection requires separate receipt", "UPDATE returns SET inspection_outcome='inconclusive',inspected_at=now() WHERE id=$1", [merchandiseReturn.rows[0].id]);
  await expectConstraintFailure("return cannot close without a decision", "UPDATE returns SET status='closed',closed_at=now(),closure_reason='no_refund_due' WHERE id=$1", [merchandiseReturn.rows[0].id]);

  await client.query(`INSERT INTO operator_commands
    (idempotency_key,command_type,target_type,target_id,operator_id,request_fingerprint,status,result)
    VALUES ('verify-pending-capture','payment.capture','order',$1,'schema-verifier',$2,'pending',$3::jsonb)`,
    [order.rows[0].id, 'a'.repeat(64), JSON.stringify({ status: 'pending', providerCaptureId: 'cpt_verify' })]);
  console.log("Verified pending capture command status.");
  await expectConstraintFailure("pending is capture only", `INSERT INTO operator_commands
    (idempotency_key,command_type,target_type,target_id,operator_id,request_fingerprint,status)
    VALUES ('verify-pending-refund','refund.create','order',$1,'schema-verifier',$2,'pending')`,
    [order.rows[0].id, 'b'.repeat(64)]);
  await expectConstraintFailure("pending capture blocks replacement key", `INSERT INTO operator_commands
    (idempotency_key,command_type,target_type,target_id,operator_id,request_fingerprint)
    VALUES ('verify-replacement','payment.capture','order',$1,'schema-verifier',$2)`,
    [order.rows[0].id, 'c'.repeat(64)]);

  await client.query("ROLLBACK");
  console.log("Schema verification passed; all test records were rolled back.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
