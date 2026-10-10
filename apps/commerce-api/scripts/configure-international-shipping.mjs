import pg from "pg";
import { shippingSetupCountries, configureInternationalShipping } from "../../../build/commerce-api/apps/commerce-api/src/runtime/configure-international-shipping.js";
const countries = shippingSetupCountries(process.env);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
try {
  if (process.env.SHIPPING_TEST_INPOST_COLLECTION !== undefined && !["true","false"].includes(process.env.SHIPPING_TEST_INPOST_COLLECTION)) throw new Error("Invalid InPost test configuration flag.");
  const scope=process.env.SHIPPING_TEST_SCOPE ?? "all";
  if (!["all","inpost-rates-only"].includes(scope)) throw new Error("Invalid shipping setup scope.");
  await configureInternationalShipping(pool, countries, process.env.SHIPPING_TEST_INPOST_COLLECTION === "true",scope === "inpost-rates-only");
  console.log(`International shipping test configuration prepared; ${new Set(countries).size} explicitly approved test destinations. No live destinations enabled.`);
} finally { await pool.end(); }
