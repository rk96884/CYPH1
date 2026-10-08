// Destructive schema setup is permitted only in an empty disposable loopback database.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
const url = new URL(process.env.SHIPPING_SNAPSHOT_TEST_DATABASE_URL ?? "postgres://invalid/invalid");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/shipping_snapshot_test" || process.env.NODE_ENV === "production")
  throw new Error("Requires an isolated loopback shipping_snapshot_test database.");
const pool = new pg.Pool({ connectionString: url.href });
try {
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0, "Database must be empty");
  for (const file of (await readdir(new URL("../db/migrations/", import.meta.url))).filter(f => f.endsWith(".sql")).sort())
    await pool.query(await readFile(new URL("../db/migrations/" + file, import.meta.url), "utf8"));
  const { configureInternationalShipping } = await import("../../../build/commerce-api/apps/commerce-api/src/runtime/configure-international-shipping.js");
  const { CheckoutService } = await import("../../../build/commerce-api/apps/commerce-api/src/checkout/service.js");
  const { PostgresCheckoutRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/checkout/postgres.js");
  const { PostgresOperationsRepository } = await import("../../../build/commerce-api/apps/commerce-api/src/operations/postgres.js");
  await configureInternationalShipping(pool, ["DE"]);
  const product = (await pool.query(`INSERT INTO products(sku,slug,name,description,status,price_minor,currency,tax_code,shipping_weight_grams,content_version)
    VALUES('SYNTHETIC','snapshot-test','Synthetic','Test only','private',100,'GBP','TEST',500,'test') RETURNING id`)).rows[0];
  await pool.query(`INSERT INTO inventory_levels(product_id,location_key,available_quantity,source,source_updated_at) VALUES($1,'test',10,'test',now())`, [product.id]);
  const repository = new PostgresCheckoutRepository(pool);
  let providerCalls = 0; let fail = false;
  const payment = { key:"mollie-test",createCheckout:async()=>{ providerCalls++; if(fail)throw new Error("synthetic declined"); return {provider:"mollie-test",providerPaymentId:"tr_test_"+providerCalls,checkoutUrl:"https://example.invalid/test",status:"pending"};} };
  const config = {commerceEnabled:true,paymentProvider:"mollie-test",fulfilmentMode:"test",fulfilmentProvider:"manual-test"};
  const urls = {orderStatusBaseUrl:"https://example.invalid/status",cancellationBaseUrl:"https://example.invalid/cancel",webhookUrl:"https://example.invalid/webhook"};
  const service = new CheckoutService(config,repository,payment,urls,true);
  const quoteInput = {productSlug:"snapshot-test",quantity:1,countryCode:"DE"};
  const first = await service.quote(quoteInput);
  const input = {productSlug:"snapshot-test",quantity:1,shippingRateId:first.shippingRateId,shippingQuoteRevision:first.shippingQuoteRevision,expectedTotalMinor:first.totalMinor,
    email:"synthetic@example.invalid",correlationId:"test",idempotencyKey:"snapshot-one",importChargesAccepted:true,
    deliveryAddress:{givenName:"Test",familyName:"Fixture",line1:"Synthetic",locality:"Test",postalCode:"00000",countryCode:"DE"}};
  const order = await service.initiate(input);
  const saved = (await pool.query("SELECT shipping_rate_snapshot,shipping_method_snapshot,delivery_minor FROM orders WHERE id=$1",[order.orderId])).rows[0];
  assert.equal(saved.shipping_rate_snapshot.totalWeightGrams,500); assert.equal(saved.shipping_rate_snapshot.quantity,1);
  assert.equal(saved.shipping_rate_snapshot.countryCode,"DE"); assert.equal(saved.shipping_rate_snapshot.version,1);
  await assert.rejects(()=>pool.query("UPDATE shipping_rates SET rate_minor=1 WHERE id=$1",[first.shippingRateId]),/immutable/);
  await assert.rejects(()=>pool.query("UPDATE shipping_rates SET maximum_weight_grams=2000 WHERE id=$1",[first.shippingRateId]),/immutable/);
  await assert.rejects(()=>pool.query("UPDATE orders SET shipping_rate_snapshot='{}'::jsonb WHERE id=$1",[order.orderId]),/immutable/);
  await assert.rejects(()=>pool.query("UPDATE orders SET delivery_minor=0,total_minor=100 WHERE id=$1",[order.orderId]),/immutable/);
  await pool.query("UPDATE shipping_rates SET status='disabled' WHERE id=$1",[first.shippingRateId]);
  await pool.query(`INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from,version,minimum_weight_grams,maximum_weight_grams)
    SELECT zone_id,shipping_method_id,country_code,rate_minor,currency,'test',effective_from,2,100,2000 FROM shipping_rates WHERE id=$1`,[first.shippingRateId]);
  const next = await service.quote(quoteInput); assert.notEqual(next.shippingQuoteRevision,first.shippingQuoteRevision);
  await assert.rejects(()=>service.initiate({...input,idempotencyKey:"stale"})); assert.equal(providerCalls,1);
  const replay=await service.initiate(input); assert.equal(replay.replayed,true); assert.equal(providerCalls,1);
  assert.deepEqual((await pool.query("SELECT shipping_rate_snapshot,shipping_method_snapshot,delivery_minor FROM orders WHERE id=$1",[order.orderId])).rows[0],saved);
  const two=await service.quote({...quoteInput,quantity:2});
  const second=await service.initiate({...input,idempotencyKey:"snapshot-two",quantity:2,shippingRateId:two.shippingRateId,shippingQuoteRevision:two.shippingQuoteRevision,expectedTotalMinor:two.totalMinor});
  const detail=await new PostgresOperationsRepository(pool).getOrder(second.orderId);
  assert.equal(detail.shippingPricingEvidence.rate.totalWeightGrams,1000);assert.equal(detail.shippingPricingEvidence.rate.maximumWeightGrams,2000);
  fail=true;
  await assert.rejects(()=>service.initiate({...input,idempotencyKey:"failed",shippingRateId:next.shippingRateId,shippingQuoteRevision:next.shippingQuoteRevision}));
  const failed=(await pool.query("SELECT o.status,o.shipping_rate_snapshot,s.state FROM orders o JOIN checkout_sessions s ON s.order_id=o.id WHERE s.idempotency_key='failed'")).rows[0];
  assert.equal(failed.status,"cancelled");assert.equal(failed.state,"failed");assert.equal(failed.shipping_rate_snapshot.amountMinor,1499);
  const raceRepository = new PostgresCheckoutRepository(pool);
  const originalCreate = raceRepository.createOrder.bind(raceRepository);
  raceRepository.createOrder = async (...args) => {await pool.query("UPDATE shipping_rates SET status='disabled' WHERE id=$1",[next.shippingRateId]);return originalCreate(...args);};
  const raceService = new CheckoutService(config,raceRepository,payment,urls,true);
  const callsBefore=providerCalls;
  await assert.rejects(()=>raceService.initiate({...input,idempotencyKey:"race",shippingRateId:next.shippingRateId,shippingQuoteRevision:next.shippingQuoteRevision}));
  assert.equal(providerCalls,callsBefore);assert.equal((await pool.query("SELECT count(*)::int AS count FROM checkout_sessions WHERE idempotency_key='race'")).rows[0].count,0);
  const historical=(await pool.query(`INSERT INTO orders(order_number,currency,subtotal_minor,total_minor,delivery_address_snapshot) VALUES('HISTORICAL','GBP',100,100,'{}') RETURNING id`)).rows[0];
  assert.equal((await new PostgresOperationsRepository(pool).getOrder(historical.id)).shippingPricingEvidence,null);
  console.log("PASS: shipping revision immutability, snapshots, weight bands, stale quotes, quantity, retries, historical reads and failure rollback on real PostgreSQL.");
} finally {await pool.end();}
