#!/usr/bin/env node
/**
 * Deliberate, disabled-only UK shipping configuration for the production database.
 * This is NOT a migration or startup task. Run --apply only after owner approval.
 */
import pg from "pg";
import process from "node:process";

const rates = Object.freeze([
  { method: "tracked-postage-packing", version: 1, minor: 399, quantities: "1" },
  { method: "tracked-postage-packing", version: 2, minor: 799, quantities: "2–3" },
  { method: "inpost-locker-shop", version: 1, minor: 259, quantities: "1–2 (Medium)" },
  { method: "inpost-locker-shop", version: 2, minor: 399, quantities: "3 (Large)" },
]);
const methods = [
  ["tracked-postage-packing", "Tracked postage and packing", "UK home delivery; physical carrier and packaging approvals pending."],
  ["inpost-locker-shop", "InPost locker/shop collection", "Manual InPost Send booking; Medium for 1–2 units, Large for 3; collection point manually confirmed."],
];
const approved = process.argv.length === 3 && process.argv[2] === "--apply";
if (process.argv.length > 2 && !approved) {
  console.error("Only --apply is supported. Without arguments this script prints a non-database plan.");
  process.exit(1);
}
if (!approved) {
  console.log(JSON.stringify({mode:"plan-only, no database connection",zone:"uk",country:"GB",status:"disabled",maxOrderQuantity:3,rates},null,2));
  process.exit(0);
}
const fail = (message) => { throw new Error(message); };
if (process.env.SHIPPING_PRODUCTION_CONFIRM !== "create-disabled-uk-only"
  || process.env.NODE_ENV !== "production"
  || process.env.COMMERCE_ENABLED !== "false"
  || process.env.CHECKOUT_HTTP_ENABLED !== "false"
  || process.env.PAYMENT_WEBHOOKS_ENABLED !== "false"
  || process.env.PAYMENT_PROVIDER !== "disabled"
  || process.env.FULFILMENT_MODE !== "disabled") {
  fail("Refusing production write: explicit confirmation and all safe-disable gates required.");
}
const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is required.");
let parsed;
try { parsed = new URL(url); } catch { fail("Invalid database URL."); }
if (!["postgres:","postgresql:"].includes(parsed.protocol)
  || decodeURIComponent(parsed.pathname.slice(1)) !== "cyph1_commerce_production") {
  fail("Refusing non-allowlisted production database name.");
}
const client = new pg.Client({
  connectionString:url,
  ssl:process.env.DATABASE_SSL === "true" ? {rejectUnauthorized:true} : false,
  application_name:"cyph1_disabled_uk_shipping_setup",
  connectionTimeoutMillis:10000,
  query_timeout:15000,
});
const expected = Object.fromEntries(rates.map(r => [r.method+":"+r.version,r.minor]));
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cyph1-production-shipping-disabled-v1'))");
  await client.query("LOCK TABLE shipping_zones, shipping_zone_countries, shipping_methods, shipping_rates IN SHARE ROW EXCLUSIVE MODE");
  const state=await client.query(`
    SELECT
      (SELECT count(*)::int FROM shipping_zones) zones,
      (SELECT count(*)::int FROM shipping_zone_countries) countries,
      (SELECT count(*)::int FROM shipping_methods) methods,
      (SELECT count(*)::int FROM shipping_rates) rates,
      (SELECT count(*)::int FROM shipping_packaging_profiles) profiles
  `);
  const s=state.rows[0];
  const empty=Object.values(s).every(x=>Number(x)===0);
  if (!empty) {
    // Repeat runs may only observe exactly the configuration previously created.
    const zones=await client.query("SELECT zone_key,name,status FROM shipping_zones");
    const countries=await client.query("SELECT c.country_code,c.destination_status,z.zone_key FROM shipping_zone_countries c JOIN shipping_zones z ON z.id=c.zone_id");
    const existingMethods=await client.query("SELECT method_key,status FROM shipping_methods");
    const existingRates=await client.query(`SELECT m.method_key,r.version,r.rate_minor,r.currency,r.status,r.country_code,r.minimum_order_minor,
      r.maximum_order_minor,r.minimum_weight_grams,r.maximum_weight_grams,r.free_shipping_threshold_minor,r.effective_to,r.carrier_tariff,
      z.zone_key FROM shipping_rates r JOIN shipping_methods m ON m.id=r.shipping_method_id
      JOIN shipping_zones z ON z.id=r.zone_id`);
    if (Number(s.profiles)!==0 || zones.rowCount!==1 || zones.rows[0].zone_key!=="uk" || zones.rows[0].status!=="disabled"
      || countries.rowCount!==1 || countries.rows[0].country_code!=="GB" || countries.rows[0].zone_key!=="uk" || countries.rows[0].destination_status!=="disabled"
      || existingMethods.rowCount!==2 || existingMethods.rows.some(m=>!methods.some(x=>x[0]===m.method_key) || m.status!=="disabled")
      || existingRates.rowCount!==4 || existingRates.rows.some(r=>!(r.method_key+":"+r.version in expected) || Number(r.rate_minor)!==expected[r.method_key+":"+r.version]
        || r.currency!=="GBP" || r.status!=="disabled" || r.country_code!=="GB" || r.zone_key!=="uk"
        || r.minimum_order_minor!==null || r.maximum_order_minor!==null || r.minimum_weight_grams!==null
        || r.maximum_weight_grams!==null || r.free_shipping_threshold_minor!==null || r.effective_to!==null || r.carrier_tariff!==null)) {
      fail("Existing shipping state differs from the expected disabled UK configuration; no changes made.");
    }
    await client.query("ROLLBACK");
    console.log("Verified existing disabled UK shipping configuration; no changes made.");
  } else {
    const z=await client.query("INSERT INTO shipping_zones(zone_key,name,status) VALUES('uk','United Kingdom','disabled') RETURNING id");
    const zoneId=z.rows[0].id;
    await client.query("INSERT INTO shipping_zone_countries(country_code,zone_id,destination_status) VALUES('GB',$1,'disabled')",[zoneId]);
    for (const [key,name,description] of methods) {
      const m=await client.query("INSERT INTO shipping_methods(method_key,name,description,status) VALUES($1,$2,$3,'disabled') RETURNING id",[key,name,description]);
      for (const rate of rates.filter(r=>r.method===key)) {
        await client.query(`INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from,version)
          VALUES($1,$2,'GB',$3,'GBP','disabled',now(),$4)`,[zoneId,m.rows[0].id,rate.minor,rate.version]);
      }
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({result:"created disabled UK-only configuration",countries:["GB"],rateCount:4,maximumQuantity:3,checkoutActivated:false,rates},null,2));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(()=>undefined);
  console.error("UK shipping setup refused or failed: "+(error.message?.startsWith("Existing shipping state")?error.message:"review restricted database logs; no further action taken."));
  process.exitCode=1;
} finally { await client.end().catch(()=>undefined); }
