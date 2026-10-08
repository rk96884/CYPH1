import pg from "pg";
import { countryCodes, normaliseCountryCode, shippingZoneForCountry, trackedPostageMethod, trackedPostageMinor } from "../../../../packages/commerce-core/src/index.js";

// Deliberately separate from startup/migrations. Never configures a production database.
export const shippingSetupCountries = (environment: Readonly<Record<string, string | undefined>>): readonly string[] => {
  if (environment.NODE_ENV === "production" || environment.PAYMENT_PROVIDER !== "mollie-test"
    || environment.SHIPPING_SETUP_CONFIRM !== "international-test-only" || environment.COMMERCE_ENABLED !== "false") {
    throw new Error("Shipping setup requires explicit non-production Mollie test configuration with commerce disabled.");
  }
  let database: URL;
  try { database = new URL(environment.DATABASE_URL ?? ""); } catch { throw new Error("Shipping setup requires a valid database URL."); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !/(?:^|[_-])(?:development|staging|test)(?:$|[_-])/i.test(decodeURIComponent(database.pathname.slice(1)))) throw new Error("Shipping setup requires a named development/staging/test database.");
  return Object.freeze((environment.SHIPPING_TEST_COUNTRIES ?? "").split(",").map(value => value.trim()).filter(Boolean).map(normaliseCountryCode));
};

export const configureInternationalShipping = async (pool: pg.Pool, testCountries: readonly string[]): Promise<void> => {
  const approved = new Set(testCountries.map(normaliseCountryCode));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('international-shipping-setup-v1'))");
    await client.query("LOCK TABLE shipping_zones, shipping_zone_countries, shipping_methods, shipping_rates IN SHARE ROW EXCLUSIVE MODE");
    // No active/restricted record may be overwritten, even in a mislabelled database.
    const protectedRows = await client.query(`SELECT country_code FROM shipping_zone_countries WHERE destination_status IN ('active','restricted')
      UNION ALL SELECT 'rate' FROM shipping_rates WHERE status='active'
      UNION ALL SELECT 'zone' FROM shipping_zones WHERE status='active'
      UNION ALL SELECT 'method' FROM shipping_methods WHERE status='active'`);
    if (protectedRows.rowCount) throw new Error("Shipping setup refuses existing active or restricted shipping configuration.");
    for (const zone of ["uk", "europe", "rest-of-world"]) {
      await client.query(`INSERT INTO shipping_zones(zone_key,name,status) VALUES($1,$1,'test') ON CONFLICT(zone_key) DO NOTHING`, [zone]);
    }
    const method = await client.query(`INSERT INTO shipping_methods(method_key,name,description,status)
      VALUES($1,'Tracked postage and packing','Postage and packing included; international import charges excluded.','test')
      ON CONFLICT(method_key) DO UPDATE SET status='test',updated_at=now() RETURNING id`, [trackedPostageMethod]);
    for (const code of countryCodes) {
      const zone = shippingZoneForCountry(code);
      await client.query(`INSERT INTO shipping_zone_countries(country_code,zone_id,destination_status)
        SELECT $1,id,'disabled' FROM shipping_zones WHERE zone_key=$2 ON CONFLICT(country_code) DO NOTHING`, [code, zone]);
      // Existing legacy test destinations keep their zone/FKs; price is determined from ISO code.
      const destination = await client.query(`UPDATE shipping_zone_countries SET destination_status=$2,updated_at=now()
        WHERE country_code=$1 RETURNING zone_id`, [code, approved.has(code) ? "test" : "disabled"]);
      await client.query(`UPDATE shipping_zones SET status='test',updated_at=now() WHERE id=$1`, [destination.rows[0].zone_id]);
      await client.query(`INSERT INTO shipping_rates(zone_id,shipping_method_id,country_code,rate_minor,currency,status,effective_from,version)
        VALUES($1,$2,$3,$4,'GBP','test',now(),1) ON CONFLICT(zone_id,shipping_method_id,country_code,version) DO UPDATE SET rate_minor=EXCLUDED.rate_minor,currency='GBP',status='test',updated_at=now()`,
      [destination.rows[0].zone_id, method.rows[0].id, code, trackedPostageMinor[zone]]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
};
