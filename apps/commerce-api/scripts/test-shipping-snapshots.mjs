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
  await assert.rejects(()=>service.quote({...quoteInput,quantity:2}),/packaging requires approval/);
  const detail=await new PostgresOperationsRepository(pool).getOrder(order.orderId);
  assert.equal(detail.shippingPricingEvidence.rate.totalWeightGrams,500);
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
  // Royal Mail phase uses synthetic tariffs and packaging only, on this disposable database.
  const {randomUUID}=await import("node:crypto");
  const {parseTariffSchedule,importDisabledTariff}=await import("../../../build/commerce-api/apps/commerce-api/src/checkout/tariff-import.js");
  await pool.query("UPDATE products SET price_minor=7499,shipping_weight_grams=953 WHERE id=$1",[product.id]);
  await pool.query(`INSERT INTO shipping_methods(method_key,name,description,status) VALUES('synthetic-carrier','Synthetic carrier','Local fixture','test')`);
  const tariff={carrier:"royal-mail",serviceId:"synthetic-carrier",carrierZone:"synthetic-zone",revision:"synthetic-v1",sourceUrl:"https://example.invalid",retrievedAt:"2026-10-08T00:00:00Z",evidenceKind:"synthetic",available:true,tracked:true,
    maximumWeightGrams:20000,maximumDimensions:{lengthMm:610,widthMm:460,heightMm:460},weightBasis:"actual",fulfilmentMethod:"manual",includedCompensationMinor:5000,maximumInsurableValueMinor:100000,additionalCompensation:{coverMinor:100000,costMinor:310},customs:"dap",contentsApproved:true,restrictions:"Synthetic test only",eligibilityEvidenceUrl:"https://example.invalid"};
  const profile={id:"synthetic-pack",version:1,productId:product.id,minimumQuantity:1,maximumQuantity:1,additionalWeightGrams:108,dimensions:{lengthMm:400,widthMm:300,heightMm:300},fulfilmentMethod:"manual",status:"disabled"};
  const multiProfile={...profile,id:"synthetic-multi",minimumQuantity:2,maximumQuantity:10,additionalWeightGrams:150,verificationStatus:"synthetic"};
  const rates=[[1,2000,1000],[2001,20000,2000]].map(([minimumWeightGrams,maximumWeightGrams,value],i)=>({id:randomUUID(),version:i+1,zoneKey:"europe",countryCode:"DE",methodKey:"synthetic-carrier",methodName:"Synthetic carrier",price:{value,currency:"GBP"},status:"disabled",effectiveFrom:"2026-01-01T00:00:00Z",minimumWeightGrams,maximumWeightGrams,carrierTariff:tariff}));
  const schedule=parseTariffSchedule({revision:"synthetic-v1",rates,packagingProfiles:[profile,multiProfile]});
  const client=await pool.connect();try{await importDisabledTariff(client,schedule);}finally{client.release();}
  const badSchedule=parseTariffSchedule({revision:"synthetic-v1",rates:rates.map((r,i)=>({...r,id:randomUUID(),version:i+10,...(i===1?{methodKey:"missing-method"}: {})})),packagingProfiles:[]});
  const badClient=await pool.connect();try{await assert.rejects(()=>importDisabledTariff(badClient,badSchedule),/must match/);}finally{badClient.release();}
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM shipping_rates WHERE carrier_tariff IS NOT NULL")).rows[0].n,2,"Partial imports must roll back");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM shipping_rates WHERE carrier_tariff IS NOT NULL AND status<>'disabled'")).rows[0].n,0);
  await pool.query("UPDATE shipping_rates SET status='test' WHERE carrier_tariff IS NOT NULL");
  await pool.query("UPDATE shipping_packaging_profiles SET status='test'");
  fail=false;
  for(const quantity of [1,2,3,4,5,10]) {
    const q=await service.quote({...quoteInput,quantity});assert.equal(q.deliveryMinor,(quantity===1?1000:2000)+310);
    const result=await service.initiate({...input,quantity,idempotencyKey:"carrier-"+quantity,shippingRateId:q.shippingRateId,shippingQuoteRevision:q.shippingQuoteRevision,expectedTotalMinor:q.totalMinor});
    const record=(await pool.query("SELECT shipping_rate_snapshot,delivery_minor FROM orders WHERE id=$1",[result.orderId])).rows[0];
    assert.equal(record.shipping_rate_snapshot.totalWeightGrams,(quantity===1?1061:quantity*953+150));assert.equal(record.shipping_rate_snapshot.billableWeightGrams,(quantity===1?1061:quantity*953+150));
    assert.equal(record.shipping_rate_snapshot.carrierCalculation.merchandiseValueMinor,quantity*7499);
    assert.equal(Number(record.delivery_minor),q.deliveryMinor);
  }
  await assert.rejects(()=>pool.query("UPDATE shipping_rates SET carrier_tariff=jsonb_set(carrier_tariff,'{revision}','\"changed\"') WHERE id=$1",[rates[0].id]),/immutable/);
  await assert.rejects(()=>pool.query("UPDATE shipping_packaging_profiles SET profile=jsonb_set(profile,'{additionalWeightGrams}','200')"),/immutable/);
  const carrierQuote=await service.quote(quoteInput);const beforeRace=providerCalls;
  const packageRace=new PostgresCheckoutRepository(pool);const packageCreate=packageRace.createOrder.bind(packageRace);
  packageRace.createOrder=async(...args)=>{await pool.query("UPDATE shipping_packaging_profiles SET status='disabled'");return packageCreate(...args);};
  await assert.rejects(()=>new CheckoutService(config,packageRace,payment,urls,true).initiate({...input,idempotencyKey:"packaging-race",shippingRateId:carrierQuote.shippingRateId,shippingQuoteRevision:carrierQuote.shippingQuoteRevision,expectedTotalMinor:carrierQuote.totalMinor}));
  assert.equal(providerCalls,beforeRace);assert.equal((await pool.query("SELECT count(*)::int AS n FROM checkout_sessions WHERE idempotency_key='packaging-race'")).rows[0].n,0);
  console.log("PASS: shipping revision immutability, snapshots, weight bands, stale quotes, quantity, retries, historical reads and failure rollback and synthetic carrier quantities/compensation/packaging races on real PostgreSQL.");
} finally {await pool.end();}
