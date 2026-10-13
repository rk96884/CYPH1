#!/usr/bin/env node
/**
 * Read-only inventory of commerce shipping configuration.
 * No DDL/DML, no seeds, no activation, and no customer/order data.
 */
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Shipping inspection failed: DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
    application_name: "cyph1_shipping_readonly_inspection",
    query_timeout: 15000,
    statement_timeout: 15000,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const schema = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [["shipping_zones", "shipping_zone_countries", "shipping_methods", "shipping_rates", "shipping_packaging_profiles"]]);
    const present = new Set(schema.rows.map(row => row.table_name));
    const missing = ["shipping_zones", "shipping_zone_countries", "shipping_methods", "shipping_rates", "shipping_packaging_profiles"].filter(table => !present.has(table));
    if (missing.length) throw new Error("Missing required shipping tables: " + missing.join(", "));

    const zones = await client.query(`
      SELECT z.zone_key, z.name, z.status AS zone_status,
             c.country_code, c.destination_status
      FROM shipping_zones z LEFT JOIN shipping_zone_countries c ON c.zone_id = z.id
      ORDER BY z.zone_key, c.country_code LIMIT 500
    `);
    const rates = await client.query(`
      SELECT m.method_key, m.name AS method_name, m.status AS method_status,
             z.zone_key, r.country_code, r.rate_minor, r.currency,
             r.status AS rate_status, r.version,
             r.minimum_weight_grams, r.maximum_weight_grams,
             r.effective_from, r.effective_to
      FROM shipping_methods m
      LEFT JOIN shipping_rates r ON r.shipping_method_id = m.id
      LEFT JOIN shipping_zones z ON z.id = r.zone_id
      ORDER BY m.method_key, r.country_code, r.version LIMIT 500
    `);
    const profiles = await client.query(`
      SELECT id, version, status FROM shipping_packaging_profiles
      ORDER BY id, version LIMIT 500
    `);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      inspection: "read-only shipping configuration",
      timestamp: new Date().toISOString(),
      note: "Rows are capped at 500 per section; absence of rows does not imply launch approval.",
      zonesAndCountries: zones.rows,
      methodsAndRates: rates.rows,
      packagingProfiles: profiles.rows,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    // Do not print raw driver errors, which can include infrastructure details.
    console.error("Shipping inspection failed: " + (error.message?.startsWith("Missing required shipping tables:") ? error.message : "database connection or read-only query failed; review restricted service logs."));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
