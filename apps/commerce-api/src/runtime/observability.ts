import { randomUUID } from "node:crypto";

export type RuntimeRoute = "health" | "readiness" | "operations" | "unknown";
export type RuntimeOutcome = "success" | "client_error" | "server_error";

export type RuntimeRequestLog = Readonly<{
  timestamp: string;
  level: "info" | "warn" | "error";
  event: "operations_http_request";
  requestId: string;
  method: string;
  route: RuntimeRoute;
  status: number;
  outcome: RuntimeOutcome;
  durationMs: number;
}>;

export const createRequestId = (): string => randomUUID();

export const classifyRuntimeRoute = (pathname: string): RuntimeRoute => {
  if (pathname === "/health") return "health";
  if (pathname === "/ready") return "readiness";
  if (pathname === "/operations" || pathname.startsWith("/operations/")) return "operations";
  return "unknown";
};

export const createRuntimeRequestLog = (input: Readonly<{
  requestId: string;
  method: string;
  pathname: string;
  status: number;
  durationMs: number;
  now?: Date;
}>): RuntimeRequestLog => {
  const outcome: RuntimeOutcome = input.status >= 500
    ? "server_error"
    : input.status >= 400
      ? "client_error"
      : "success";
  return Object.freeze({
    timestamp: (input.now ?? new Date()).toISOString(),
    level: outcome === "server_error" ? "error" : outcome === "client_error" ? "warn" : "info",
    event: "operations_http_request",
    requestId: input.requestId,
    method: input.method,
    route: classifyRuntimeRoute(input.pathname),
    status: input.status,
    outcome,
    durationMs: Math.max(0, Math.round(input.durationMs)),
  });
};

export const writeRuntimeRequestLog = (entry: RuntimeRequestLog): void => {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
};
