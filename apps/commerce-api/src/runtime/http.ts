import type { IncomingHttpHeaders } from "node:http";

type ProtectedHandler = (request: Request) => Promise<Response>;
type ReadinessCheck = () => Promise<void>;

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

export const createOperationsRuntime = (
  operations: ProtectedHandler,
  readiness: ReadinessCheck,
): ((request: Request) => Promise<Response>) => async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });
  if (request.method === "GET" && url.pathname === "/ready") {
    try {
      await readiness();
      return json({ status: "ready" });
    } catch {
      return json({ status: "unavailable" }, 503);
    }
  }
  if (url.pathname === "/operations" || url.pathname.startsWith("/operations/")) return operations(request);
  return json({ message: "Not found." }, 404);
};

export const requestHeaders = (incoming: IncomingHttpHeaders): Headers => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
};

