import pg from "pg";
import { shippingSetupCountries, configureInternationalShipping } from "../../../build/commerce-api/apps/commerce-api/src/runtime/configure-international-shipping.js";
const countries = shippingSetupCountries(process.env);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
try {
  await configureInternationalShipping(pool, countries);
  console.log(`International shipping test configuration prepared; ${new Set(countries).size} explicitly approved test destinations. No live destinations enabled.`);
} finally { await pool.end(); }
