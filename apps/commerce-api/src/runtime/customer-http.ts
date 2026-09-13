type Handler = (request: Request) => Promise<Response>;
type ReadinessCheck = () => Promise<void>;
type Environment = Readonly<Record<string, string | undefined>>;

export type CustomerRouteGates = Readonly<{
  checkoutEnabled: boolean;
  paymentWebhooksEnabled: boolean;
}>;

export const loadCustomerRuntimeOrigin = (environment: Environment): string => {
  const configured = environment.CUSTOMER_RUNTIME_ORIGIN?.trim();
  if (!configured) throw new Error("CUSTOMER_RUNTIME_ORIGIN is required.");
  let origin: URL;
  try { origin = new URL(configured); } catch { throw new Error("CUSTOMER_RUNTIME_ORIGIN must be a valid HTTPS origin."); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("CUSTOMER_RUNTIME_ORIGIN must be an HTTPS origin without credentials, path, query or fragment.");
  }
  return origin.origin;
};

export const customerRequestUrl = (origin: string, requestTarget: string): string => {
  const target = new URL(requestTarget, origin);
  if (target.origin !== origin) throw new Error("The incoming request target must remain on the configured customer origin.");
  return target.href;
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: securityHeaders });

const strictBoolean = (value: string | undefined, name: string): boolean => {
  if (value === undefined || value.trim() === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be either true or false.`);
};

export const loadCustomerRouteGates = (environment: Environment): CustomerRouteGates => Object.freeze({
  checkoutEnabled: strictBoolean(environment.CHECKOUT_HTTP_ENABLED, "CHECKOUT_HTTP_ENABLED"),
  paymentWebhooksEnabled: strictBoolean(environment.PAYMENT_WEBHOOKS_ENABLED, "PAYMENT_WEBHOOKS_ENABLED"),
});

export const loadPrivateCheckoutFixtureEnabled = (environment: Environment): boolean => {
  const enabled = strictBoolean(environment.PRIVATE_CHECKOUT_FIXTURE_ENABLED, "PRIVATE_CHECKOUT_FIXTURE_ENABLED");
  if (!enabled) return false;

  const required = [
    ["CHECKOUT_HTTP_ENABLED", "true"],
    ["COMMERCE_ENABLED", "true"],
    ["PAYMENT_PROVIDER", "mollie-test"],
    ["FULFILMENT_MODE", "test"],
    ["FULFILMENT_PROVIDER", "manual-test"],
  ] as const;
  const invalid = required.filter(([name, value]) => environment[name] !== value).map(([name]) => name);
  if (invalid.length > 0) {
    throw new Error(`PRIVATE_CHECKOUT_FIXTURE_ENABLED requires reviewed test configuration: ${invalid.join(", ")}.`);
  }
  return true;
};

export const createCustomerRuntime = (input: Readonly<{
  checkout: Handler;
  paymentWebhook: Handler;
  readiness: ReadinessCheck;
  gates: CustomerRouteGates;
}>): Handler => async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });
  if (request.method === "GET" && url.pathname === "/ready") {
    try {
      await input.readiness();
      return json({ status: "ready" });
    } catch {
      return json({ status: "unavailable" }, 503);
    }
  }
  if (url.pathname === "/checkout") {
    if (!input.gates.checkoutEnabled) return json({ message: "Not found." }, 404);
    return input.checkout(request);
  }
  if (url.pathname === "/webhooks/mollie") {
    if (!input.gates.paymentWebhooksEnabled) return json({ message: "Not found." }, 404);
    return input.paymentWebhook(request);
  }
  return json({ message: "Not found." }, 404);
};
