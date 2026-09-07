import { pathToFileURL } from "node:url";

const endpoints = Object.freeze([
  Object.freeze({ label: "health", path: "/health", body: Object.freeze({ status: "ok" }) }),
  Object.freeze({ label: "readiness", path: "/ready", body: Object.freeze({ status: "ready" }) }),
]);

const integer = (value, fallback, name, minimum, maximum) => {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
};

export const loadProbeConfig = (environment) => {
  if (environment.COMMERCE_LOAD_CONFIRM !== "synthetic-read-only") {
    throw new Error("COMMERCE_LOAD_CONFIRM must be exactly synthetic-read-only.");
  }
  const rawOrigin = environment.COMMERCE_LOAD_ORIGIN?.trim();
  if (!rawOrigin) throw new Error("COMMERCE_LOAD_ORIGIN is required.");
  const origin = new URL(rawOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("COMMERCE_LOAD_ORIGIN must be a credential-free HTTPS origin without a path, query or fragment.");
  }
  return Object.freeze({
    origin,
    requests: integer(environment.COMMERCE_LOAD_REQUESTS, 40, "COMMERCE_LOAD_REQUESTS", 2, 200),
    concurrency: integer(environment.COMMERCE_LOAD_CONCURRENCY, 4, "COMMERCE_LOAD_CONCURRENCY", 1, 10),
    timeoutMs: integer(environment.COMMERCE_LOAD_TIMEOUT_MS, 5_000, "COMMERCE_LOAD_TIMEOUT_MS", 250, 30_000),
    maximumP95Ms: integer(environment.COMMERCE_LOAD_MAXIMUM_P95_MS, 2_000, "COMMERCE_LOAD_MAXIMUM_P95_MS", 50, 30_000),
  });
};

const percentile = (values, fraction) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
};

export const runBoundedProbe = async ({ config, fetchImpl = fetch, now = () => performance.now() }) => {
  let nextRequest = 0;
  let active = 0;
  let peakConcurrency = 0;
  const observations = [];

  const worker = async () => {
    while (true) {
      const requestNumber = nextRequest++;
      if (requestNumber >= config.requests) return;
      const endpoint = endpoints[requestNumber % endpoints.length];
      active += 1;
      peakConcurrency = Math.max(peakConcurrency, active);
      const startedAt = now();
      try {
        const response = await fetchImpl(new URL(endpoint.path, config.origin), {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: { Accept: "application/json" },
        });
        const body = await response.json().catch(() => undefined);
        const valid = response.status === 200 && JSON.stringify(body) === JSON.stringify(endpoint.body);
        observations.push(Object.freeze({ endpoint: endpoint.label, durationMs: Math.max(0, now() - startedAt), valid, status: response.status }));
      } catch {
        observations.push(Object.freeze({ endpoint: endpoint.label, durationMs: Math.max(0, now() - startedAt), valid: false, status: 0 }));
      } finally {
        active -= 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(config.concurrency, config.requests) }, worker));
  const durations = observations.map((observation) => observation.durationMs);
  const failures = observations.filter((observation) => !observation.valid);
  const result = Object.freeze({
    requests: observations.length,
    failures: failures.length,
    peakConcurrency,
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maximumMs: Math.round(Math.max(...durations, 0)),
  });
  if (result.failures) throw new Error(`Bounded staging probe failed: ${result.failures} of ${result.requests} responses were invalid.`);
  if (result.p95Ms > config.maximumP95Ms) {
    throw new Error(`Bounded staging probe failed: p95 ${result.p95Ms} ms exceeded ${config.maximumP95Ms} ms.`);
  }
  return result;
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const result = await runBoundedProbe({ config: loadProbeConfig(process.env) });
    console.log(`Bounded read-only probe passed: ${result.requests} requests, peak concurrency ${result.peakConcurrency}, p50 ${result.p50Ms} ms, p95 ${result.p95Ms} ms, max ${result.maximumMs} ms.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Bounded staging probe failed.");
    process.exitCode = 1;
  }
}
