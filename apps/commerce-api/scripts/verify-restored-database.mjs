import process from "node:process";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;

const expectedTables = Object.freeze([
  "products", "inventory_levels", "customers", "customer_consents", "addresses",
  "shipping_zones", "shipping_zone_countries", "shipping_methods", "shipping_rates",
  "orders", "order_items", "payments", "refunds", "webhook_deliveries", "webhook_events",
  "fulfilments", "outbox_events", "checkout_sessions", "fulfilment_events", "operator_commands",
  "communication_deliveries", "audit_events", "schema_migrations",
]);

const strictBoolean = (value, name) => {
  if (value === undefined || value.trim() === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be either true or false.`);
};

const databaseIdentity = (value, name) => {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error(`${name} must be a valid PostgreSQL URL.`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  return Object.freeze({ url: value.trim(), host: url.hostname.toLowerCase(), database: decodeURIComponent(url.pathname.slice(1)) });
};

export const loadRestoreVerificationConfig = (environment) => {
  if (environment.ALLOW_DATABASE_RESTORE_VERIFICATION !== "true" ||
      environment.DATABASE_RESTORE_VERIFICATION_CONFIRM !== "restore-rehearsal") {
    throw new Error("Restore verification requires both explicit rehearsal guards.");
  }
  const source = databaseIdentity(environment.SOURCE_DATABASE_URL, "SOURCE_DATABASE_URL");
  const restore = databaseIdentity(environment.RESTORE_DATABASE_URL, "RESTORE_DATABASE_URL");
  if (source.host === restore.host && source.database === restore.database) {
    throw new Error("The restore target must be different from the source database.");
  }
  if (!/(restore|recovery|test)/i.test(restore.database)) {
    throw new Error("The restore target database name must contain restore, recovery or test.");
  }
  return Object.freeze({
    source,
    restore,
    sourceSsl: strictBoolean(environment.SOURCE_DATABASE_SSL, "SOURCE_DATABASE_SSL"),
    restoreSsl: strictBoolean(environment.RESTORE_DATABASE_SSL, "RESTORE_DATABASE_SSL"),
  });
};

const snapshot = async (client) => {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const migrations = await client.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
    const counts = {};
    for (const table of expectedTables) {
      const result = await client.query(`SELECT COUNT(*)::text AS count FROM ${table}`);
      counts[table] = result.rows[0].count;
    }
    await client.query("COMMIT");
    return Object.freeze({ migrations: migrations.rows, counts: Object.freeze(counts) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
};

export const compareRestoreSnapshots = (source, restore) => {
  if (JSON.stringify(source.migrations) !== JSON.stringify(restore.migrations)) {
    throw new Error("The restored migration history does not match the source.");
  }
  const differences = expectedTables.filter((table) => source.counts[table] !== restore.counts[table]);
  if (differences.length > 0) throw new Error(`Restored row counts differ: ${differences.join(", ")}.`);
  return Object.freeze({ migrationCount: source.migrations.length, tableCount: expectedTables.length });
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const config = loadRestoreVerificationConfig(process.env);
  const sourceClient = new Client({
    connectionString: config.source.url,
    ssl: config.sourceSsl ? { rejectUnauthorized: true } : false,
  });
  const restoreClient = new Client({
    connectionString: config.restore.url,
    ssl: config.restoreSsl ? { rejectUnauthorized: true } : false,
  });

  await Promise.all([sourceClient.connect(), restoreClient.connect()]);
  try {
    const [sourceSnapshot, restoreSnapshot] = await Promise.all([snapshot(sourceClient), snapshot(restoreClient)]);
    const result = compareRestoreSnapshots(sourceSnapshot, restoreSnapshot);
    console.log(`Verified matching migration history: ${result.migrationCount} migrations.`);
    console.log(`Verified matching aggregate row counts: ${result.tableCount} tables.`);
    console.log("Restore comparison passed without reading personal-data fields.");
  } finally {
    await Promise.all([sourceClient.end(), restoreClient.end()]);
  }
}
