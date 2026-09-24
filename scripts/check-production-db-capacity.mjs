import pg from "pg";

const integer = (value, fallback, name, minimum, maximum) => {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
};

export const loadProbeConfig = (environment) => {
  if (environment.PRODUCTION_DB_PROBE_CONFIRM !== "synthetic-read-only-no-commerce") {
    throw new Error("PRODUCTION_DB_PROBE_CONFIRM must be exactly synthetic-read-only-no-commerce.");
  }
  if (environment.COMMERCE_ENABLED !== "false" || environment.CHECKOUT_HTTP_ENABLED !== "false" ||
      environment.PAYMENT_WEBHOOKS_ENABLED !== "false" || environment.PAYMENT_PROVIDER !== "disabled" ||
      environment.FULFILMENT_MODE !== "disabled" || environment.FULFILMENT_PROVIDER !== "disabled") {
    throw new Error("Production database probe requires the locked commerce baseline.");
  }
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const databaseName = new URL(connectionString).pathname.slice(1).toLowerCase();
  if (!databaseName.includes("production")) throw new Error("Refusing to probe a database whose name does not contain production.");
  return Object.freeze({
    connectionString,
    ssl: environment.DATABASE_SSL === "true",
    requests: integer(environment.PRODUCTION_DB_PROBE_REQUESTS, 40, "PRODUCTION_DB_PROBE_REQUESTS", 2, 100),
    concurrency: integer(environment.PRODUCTION_DB_PROBE_CONCURRENCY, 4, "PRODUCTION_DB_PROBE_CONCURRENCY", 1, 8),
    maximumP95Ms: integer(environment.PRODUCTION_DB_PROBE_MAXIMUM_P95_MS, 500, "PRODUCTION_DB_PROBE_MAXIMUM_P95_MS", 10, 5000),
  });
};

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.ceil(sorted.length * fraction)-1] ?? 0;
};

export const runProbe = async ({ config, Pool = pg.Pool, now = () => performance.now() }) => {
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: true } : false,
    max: config.concurrency,
    application_name: "cyph1-production-db-readonly-probe",
  });
  let next = 0, active = 0, peakConcurrency = 0;
  const observations = [];
  const worker = async () => {
    while (true) {
      const requestNumber = next++;
      if (requestNumber >= config.requests) return;
      active++; peakConcurrency = Math.max(peakConcurrency, active);
      const started = now();
      try {
        const result = await pool.query("SELECT 1 AS probe");
        observations.push({ valid: result.rowCount === 1 && Number(result.rows[0]?.probe) === 1, durationMs: Math.max(0, now()-started) });
      } catch {
        observations.push({ valid:false, durationMs:Math.max(0,now()-started) });
      } finally { active--; }
    }
  };
  try { await Promise.all(Array.from({length:Math.min(config.concurrency,config.requests)},worker)); }
  finally { await pool.end(); }
  const durations=observations.map(x=>x.durationMs);
  const result=Object.freeze({
    requests:observations.length,
    failures:observations.filter(x=>!x.valid).length,
    peakConcurrency,
    p50Ms:Math.round(percentile(durations,.5)),
    p95Ms:Math.round(percentile(durations,.95)),
    maximumMs:Math.round(Math.max(...durations,0)),
  });
  if(result.failures) throw new Error(`Bounded production DB probe failed: ${result.failures} of ${result.requests} queries failed.`);
  if(result.p95Ms>config.maximumP95Ms) throw new Error(`Bounded production DB probe failed: p95 ${result.p95Ms} ms exceeded ${config.maximumP95Ms} ms.`);
  return result;
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const result=await runProbe({config:loadProbeConfig(process.env)});
    console.log(`Bounded production DB read-only probe passed: ${result.requests} queries; peak concurrency ${result.peakConcurrency}; p50 ${result.p50Ms} ms; p95 ${result.p95Ms} ms; max ${result.maximumMs} ms.`);
  } catch(error) { console.error(error instanceof Error ? error.message : "Production DB probe failed."); process.exitCode=1; }
}
