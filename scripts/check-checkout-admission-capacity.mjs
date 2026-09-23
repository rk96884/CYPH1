import { pathToFileURL } from "node:url";

const integer = (value, fallback, name, minimum, maximum) => {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
};

export const loadCheckoutProbeConfig = (environment) => {
  if (environment.CHECKOUT_PROBE_CONFIRM !== "synthetic-malformed-no-payment") {
    throw new Error("CHECKOUT_PROBE_CONFIRM must be exactly synthetic-malformed-no-payment.");
  }
  const rawOrigin = environment.CHECKOUT_PROBE_ORIGIN?.trim();
  if (!rawOrigin) throw new Error("CHECKOUT_PROBE_ORIGIN is required.");
  const origin = new URL(rawOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("CHECKOUT_PROBE_ORIGIN must be a credential-free HTTPS origin without a path, query or fragment.");
  }
  const storefrontOrigin = environment.CHECKOUT_PROBE_STOREFRONT_ORIGIN?.trim();
  if (!storefrontOrigin) throw new Error("CHECKOUT_PROBE_STOREFRONT_ORIGIN is required.");
  const storefront = new URL(storefrontOrigin);
  if (storefront.protocol !== "https:" || storefront.username || storefront.password || storefront.pathname !== "/" || storefront.search || storefront.hash) {
    throw new Error("CHECKOUT_PROBE_STOREFRONT_ORIGIN must be a credential-free HTTPS origin.");
  }
  return Object.freeze({
    origin,
    storefrontOrigin: storefront.origin,
    requests: integer(environment.CHECKOUT_PROBE_REQUESTS, 12, "CHECKOUT_PROBE_REQUESTS", 2, 40),
    concurrency: integer(environment.CHECKOUT_PROBE_CONCURRENCY, 2, "CHECKOUT_PROBE_CONCURRENCY", 1, 5),
    timeoutMs: integer(environment.CHECKOUT_PROBE_TIMEOUT_MS, 5_000, "CHECKOUT_PROBE_TIMEOUT_MS", 250, 10_000),
  });
};

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0;
};

export const runCheckoutAdmissionProbe = async ({ config, fetchImpl = fetch, now = () => performance.now() }) => {
  let next = 0;
  let active = 0;
  let peakConcurrency = 0;
  const observations = [];
  const worker = async () => {
    while (true) {
      const requestNumber = next++;
      if (requestNumber >= config.requests) return;
      active += 1;
      peakConcurrency = Math.max(peakConcurrency, active);
      const startedAt = now();
      try {
        const response = await fetchImpl(new URL("/checkout", config.origin), {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Origin: config.storefrontOrigin,
            "Idempotency-Key": `capacity-probe-${requestNumber}-00000000`,
          },
          body: "{}",
        });
        const rawBody = await response.text().catch(() => "");
        let body;
        try { body = JSON.parse(rawBody); } catch { body = undefined; }
        const expected400 = response.status === 400 && body?.message === "Invalid request.";
        const application429 = response.status === 429 && body?.message === "Checkout is temporarily busy." && Number(response.headers.get("retry-after")) > 0;
        const edge429 = response.status === 429 && !application429 && (
          /error code:\s*1015/i.test(rawBody) ||
          response.headers.get("server")?.toLowerCase() === "cloudflare"
        );
        observations.push({
          status: response.status,
          kind: expected400 ? "validation" : application429 ? "application-limit" : edge429 ? "edge-limit" : "unexpected",
          valid: expected400 || application429 || edge429,
          durationMs: Math.max(0, now() - startedAt),
        });
      } catch {
        observations.push({ status: 0, valid: false, durationMs: Math.max(0, now() - startedAt) });
      } finally {
        active -= 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(config.concurrency, config.requests) }, worker));
  const failures = observations.filter((x) => !x.valid);
  if (failures.length) throw new Error(`Checkout admission probe failed: ${failures.length} unexpected responses.`);
  const durations = observations.map((x) => x.durationMs);
  return Object.freeze({
    requests: observations.length,
    admittedValidationResponses: observations.filter((x) => x.status === 400).length,
    applicationLimitedResponses: observations.filter((x) => x.kind === "application-limit").length,
    edgeLimitedResponses: observations.filter((x) => x.kind === "edge-limit").length,
    peakConcurrency,
    p50Ms: Math.round(percentile(durations, .5)),
    p95Ms: Math.round(percentile(durations, .95)),
    maximumMs: Math.round(Math.max(...durations, 0)),
  });
};

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  try {
    const result = await runCheckoutAdmissionProbe({ config: loadCheckoutProbeConfig(process.env) });
    console.log(`Bounded checkout admission probe passed: ${result.requests} requests; 400=${result.admittedValidationResponses}; app-429=${result.applicationLimitedResponses}; edge-429=${result.edgeLimitedResponses}; peak concurrency ${result.peakConcurrency}; p50 ${result.p50Ms} ms; p95 ${result.p95Ms} ms; max ${result.maximumMs} ms.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Checkout admission probe failed.");
    process.exitCode = 1;
  }
}
