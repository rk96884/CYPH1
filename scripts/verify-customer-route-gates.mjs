import { pathToFileURL } from "node:url";

const expectedModes = Object.freeze({
  disabled: Object.freeze({ checkout: 404, webhook: 404 }),
  active: Object.freeze({ checkout: 405, webhook: 405 }),
  contained: Object.freeze({ checkout: 404, webhook: 405 }),
});

export const parseCustomerRuntimeOrigin = (value) => {
  if (!value?.trim()) throw new Error("CUSTOMER_RUNTIME_ORIGIN is required.");
  const origin = new URL(value.trim());
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("The customer runtime origin must be an HTTPS origin without credentials, a query or a fragment.");
  }
  if (origin.pathname !== "/") throw new Error("The customer runtime origin must not contain a path.");
  return origin;
};

export const parseRouteGateMode = (value) => {
  const mode = value?.trim();
  if (!mode || !Object.hasOwn(expectedModes, mode)) {
    throw new Error("CUSTOMER_ROUTE_GATE_MODE must be disabled, active or contained.");
  }
  return mode;
};

const expectedResponse = (status) => status === 404
  ? { message: "Not found." }
  : { message: "Method not allowed." };

const checkEndpoint = async ({ origin, path, label, expectedStatus, fetchImpl, timeoutMs }) => {
  const response = await fetchImpl(new URL(path, origin), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/json" },
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned HTTP ${response.status}; expected ${expectedStatus}.`);
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`${label} did not return JSON.`); }
  if (JSON.stringify(body) !== JSON.stringify(expectedResponse(expectedStatus))) {
    throw new Error(`${label} returned an unexpected response.`);
  }
  if (response.headers.get("cache-control") !== "no-store") {
    throw new Error(`${label} did not return the required no-store policy.`);
  }
  if (expectedStatus === 405 && response.headers.get("allow") !== "POST") {
    throw new Error(`${label} did not advertise only POST.`);
  }
  return Object.freeze({ endpoint: label, status: response.status });
};

export const verifyCustomerRouteGates = async ({
  origin,
  mode,
  fetchImpl = fetch,
  timeoutMs = 30_000,
}) => {
  const expected = expectedModes[mode];
  if (!expected) throw new Error("The customer route-gate mode is invalid.");
  const results = [];
  results.push(await checkEndpoint({
    origin, path: "/checkout", label: "checkout", expectedStatus: expected.checkout, fetchImpl, timeoutMs,
  }));
  results.push(await checkEndpoint({
    origin, path: "/webhooks/mollie", label: "payment webhook", expectedStatus: expected.webhook, fetchImpl, timeoutMs,
  }));
  return Object.freeze(results);
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const origin = parseCustomerRuntimeOrigin(process.env.CUSTOMER_RUNTIME_ORIGIN);
    const mode = parseRouteGateMode(process.env.CUSTOMER_ROUTE_GATE_MODE);
    const results = await verifyCustomerRouteGates({ origin, mode });
    for (const result of results) console.log(`${result.endpoint}: HTTP ${result.status}`);
    console.log(`Verified customer route-gate mode: ${mode}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Customer route-gate verification failed.");
    process.exitCode = 1;
  }
}
