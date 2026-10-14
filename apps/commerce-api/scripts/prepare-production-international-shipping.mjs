#!/usr/bin/env node
/**
 * Explicit, disabled-only international shipping preparation.
 * No database connection without --apply and full production safety approvals.
 * Existing UK shipping configuration is read and verified, never updated.
 */
import pg from "pg";

const candidates = Object.freeze({
  europe: ["DE","FR","IE","ES","TR"],
  apac: ["SG","MY","TH","JP","IN","HK","AU","NZ"],
  "middle-east": ["AE","SA","QA","KW","BH","OM"],
  latam: ["BR","MX","CL","CO","AR"],
  "rest-of-world": ["CA","ZA"],
});
const zoneForGroup = key => key === "europe" ? "europe" : "rest-of-world";
const rateForGroup = key => key === "europe" ? 1499 : 2599;
const supported = new Map(Object.entries(candidates).flatMap(([group,codes])=>codes.map(code=>[code,{group,zone:zoneForGroup(group),minor:rateForGroup(group)}])));
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--apply")) {
  console.error("Only --apply is supported. No arguments prints a plan without database access.");
  process.exit(1);
}
const plan = [...supported].map(([countryCode,value])=>({countryCode,...value,status:"disabled"}));
if (!args.length) {
  console.log(JSON.stringify({mode:"plan-only",databaseConnected:false,existingUk:"unchanged",usa:"excluded",method:"tracked-postage-packing",newZones:["europe","rest-of-world"],destinations:plan},null,2));
  process.exit(0);
}
const fail = message => { throw new Error(message); };
if (process.env.SHIPPING_PRODUCTION_CONFIRM !== "create-disabled-international-only"
  || process.env.NODE_ENV !== "production"
  || process.env.COMMERCE_ENABLED !== "false"
  || process.env.CHECKOUT_HTTP_ENABLED !== "false"
  || process.env.PAYMENT_WEBHOOKS_ENABLED !== "false"
  || process.env.PAYMENT_PROVIDER !== "disabled"
  || process.env.FULFILMENT_MODE !== "disabled"
  || process.env.FULFILMENT_PROVIDER !== "disabled") {
  fail("Refusing production write: explicit disabled-only confirmation and safe gates are required.");
}
let db;
try { db = new URL(process.env.DATABASE_URL ?? ""); }
catch { fail("DATABASE_URL is required and must be valid."); }
if (!["postgres:","postgresql:"].includes(db.protocol) || decodeURIComponent(db.pathname.slice(1)) !== "cyph1_commerce_production")
  fail("Refusing non-allowlisted production database.");
const client = new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL === "true" ? {rejectUnauthorized:true} : false,
  application_name:"cyph1_disabled_international_shipping_setup",
  connectionTimeoutMillis:10000,
  query_timeout:15000,
});
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cyph1-production-shipping-disabled-v1'))");
  await client.query("LOCK TABLE shipping_zones, shipping_zone_countries, shipping_methods, shipping_rates IN SHARE ROW EXCLUSIVE MODE");
  const zones = await client.query("SELECT id,zone_key,status FROM shipping_zones");
  const countries = await client.query("SELECT country_code,zone_id,destination_status FROM shipping_zone_countries");
  const methods = await client.query("SELECT id,method_key,status FROM shipping_methods");
  const rates = await client.query(`SELECT r.id,r.zone_id,r.shipping_method_id,r.country_code,r.version,r.rate_minor,r.currency,r.status,
    r.minimum_order_minor,r.maximum_order_minor,r.minimum_weight_grams,r.maximum_weight_grams,
    r.free_shipping_threshold_minor,r.effective_to,r.carrier_tariff,m.method_key,z.zone_key
    FROM shipping_rates r JOIN shipping_methods m ON m.id=r.shipping_method_id JOIN shipping_zones z ON z.id=r.zone_id`);
  const profiles = await client.query("SELECT count(*)::int AS n FROM shipping_packaging_profiles");
  const zoneById = new Map(zones.rows.map(z=>[z.id,z.zone_key]));
  const zoneByKey = new Map(zones.rows.map(z=>[z.zone_key,z]));
  const methodById = new Map(methods.rows.map(m=>[m.id,m.method_key]));
  const methodByKey = new Map(methods.rows.map(m=>[m.method_key,m]));
  const ukExpected = new Map([["tracked-postage-packing:1",399],["tracked-postage-packing:2",799],["inpost-locker-shop:1",259],["inpost-locker-shop:2",399]]);
  const validRate = r => r.currency==="GBP" && r.status==="disabled"
    && r.minimum_order_minor===null && r.maximum_order_minor===null
    && r.minimum_weight_grams===null && r.maximum_weight_grams===null
    && r.free_shipping_threshold_minor===null && r.effective_to===null && r.carrier_tariff===null;
  if (Number(profiles.rows[0]?.n)!==0 || methods.rows.length!==2
    || !["tracked-postage-packing","inpost-locker-shop"].every(k=>methodByKey.get(k)?.status==="disabled")
    || zoneByKey.get("uk")?.status!=="disabled"
    || zones.rows.some(z=>!["uk","europe","rest-of-world"].includes(z.zone_key)||z.status!=="disabled")
    || countries.rows.some(c=>c.destination_status!=="disabled" || (c.country_code!=="GB" && !supported.has(c.country_code))
      || zoneById.get(c.zone_id)!==(c.country_code==="GB"?"uk":supported.get(c.country_code)?.zone))
    || countries.rows.filter(c=>c.country_code==="GB").length!==1
    || rates.rows.some(r=>!validRate(r) || (r.country_code==="GB"
      ? r.zone_key!=="uk" || !ukExpected.has(r.method_key+":"+r.version) || Number(r.rate_minor)!==ukExpected.get(r.method_key+":"+r.version)
      : !supported.has(r.country_code) || r.method_key!=="tracked-postage-packing" || r.version!==1
        || r.zone_key!==supported.get(r.country_code).zone || Number(r.rate_minor)!==supported.get(r.country_code).minor))
    || rates.rows.filter(r=>r.country_code==="GB").length!==4
    || new Set(rates.rows.map(r=>r.country_code+":"+r.method_key+":"+r.version)).size!==rates.rows.length) {
    fail("Unexpected shipping state: only exact disabled UK baseline and matching disabled international records are supported.");
  }
  const home=methodByKey.get("tracked-postage-packing");
  for (const key of ["europe","rest-of-world"]) {
    if (!zoneByKey.has(key)) {
      const result=await client.query("INSERT INTO shipping_zones(zone_key,name,status) VALUES($1,$2,'disabled') RETURNING id,zone_key,status",[key,key==="europe"?"Europe":"Rest of world"]);
      zoneByKey.set(key,result.rows[0]);
    }
  }
  let inserted=0;
  for (const [code,value] of supported) {
    const zoneId=zoneByKey.get(value.zone).id;
    if (!countries.rows.some(c=>c.country_code===code)) {
      await client.query("INSERT INTO shipping_zone_countries(country_code,zone_id,destination_status) VALUES($1,$2,'disabled')",[code,zoneId]);
      inserted++;
    }
    if (!rates.rows.some(r=>r.country_code===code)) {
      await client.query(`INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from,version)
        VALUES($1,$2,$3,$4,'GBP','disabled',now(),1)`,[zoneId,home.id,code,value.minor]);
    }
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({result:"disabled-only international setup",newCountries:inserted,totalCandidates:supported.size,usa:"excluded",ukModified:false,checkoutActivated:false},null,2));
} catch (error) {
  await client.query("ROLLBACK").catch(()=>undefined);
  console.error(error.message?.startsWith("Unexpected shipping state:") ? error.message : "International shipping setup refused or failed. Consult restricted operator logs.");
  process.exitCode=1;
} finally { await client.end().catch(()=>undefined); }
