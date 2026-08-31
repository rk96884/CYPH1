const expectedResponses = [
  { label: "health", path: "/health", body: { status: "ok" } },
  { label: "readiness", path: "/ready", body: { status: "ready" } },
];

export const parseStagingOrigin = (value) => {
  if (!value?.trim()) throw new Error("COMMERCE_STAGING_ORIGIN is required.");
  const origin = new URL(value.trim());
  if (origin.protocol !== "https:") throw new Error("The staging origin must use HTTPS.");
  if (origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("The staging origin must not contain credentials, a query or a fragment.");
  }
  if (origin.pathname !== "/") throw new Error("The staging origin must not contain a path.");
  return origin;
};

export const checkCommerceStaging = async ({ origin, fetchImpl = fetch, timeoutMs = 10_000 }) => {
  const results = [];
  for (const endpoint of expectedResponses) {
    const response = await fetchImpl(new URL(endpoint.path, origin), {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`${endpoint.label} check returned HTTP ${response.status}.`);
    let body;
    try { body = await response.json(); }
    catch { throw new Error(`${endpoint.label} check did not return JSON.`); }
    if (JSON.stringify(body) !== JSON.stringify(endpoint.body)) {
      throw new Error(`${endpoint.label} check returned an unexpected response.`);
    }
    results.push({ endpoint: endpoint.label, status: response.status });
  }
  return results;
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const origin = parseStagingOrigin(process.env.COMMERCE_STAGING_ORIGIN);
    const results = await checkCommerceStaging({ origin });
    for (const result of results) console.log(`${result.endpoint}: HTTP ${result.status}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging check failed.");
    process.exitCode = 1;
  }
}
import { pathToFileURL } from "node:url";
