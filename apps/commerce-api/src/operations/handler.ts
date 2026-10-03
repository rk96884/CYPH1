import { operationPermissions, OperationsError, type OperationPermission, type OperationsPrincipal, type OperationsService, type RefundReason } from "./service.js";
import { ReturnDomainError, type ReturnAction } from "../../../../packages/commerce-core/src/index.js";
import type { ReturnService } from "../returns/service.js";

const securityHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" };
const headers = { "Content-Type": "application/json; charset=utf-8", ...securityHeaders };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const allowed = (principal: OperationsPrincipal | undefined, permission: OperationPermission): principal is OperationsPrincipal => !!principal?.permissions.includes(permission);
const validPrincipal = (principal: OperationsPrincipal | undefined): principal is OperationsPrincipal => {
  if (!principal || !principal.id.trim() || principal.id.length > 254) return false;
  const known: readonly OperationPermission[] = operationPermissions;
  return new Set(principal.permissions).size === principal.permissions.length && principal.permissions.every((permission) => known.includes(permission));
};
const safeCsv = (value: unknown): string => {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export const reconciliationCsvColumns = Object.freeze([
  "order_number", "order_created_at", "order_status", "fulfilment_status", "currency", "total_minor",
  "checkout_state", "checkout_failure_code", "provider", "provider_payment_id", "payment_created_at",
  "payment_status", "amount_minor", "refunded_minor", "open_refund_minor",
  "resolution_required_refund_minor", "failed_refund_minor", "refund_count",
  "fulfilment_reference", "fulfilment_record_status",
] as const);
const csv = (rows: readonly Readonly<Record<string, unknown>>[]): string => {
  return [
    reconciliationCsvColumns.map(safeCsv).join(","),
    ...rows.map((row) => reconciliationCsvColumns.map((column) => safeCsv(row[column])).join(",")),
  ].join("\r\n");
};
const captureReconciliationMessages = {
  capture_reconciled: "Capture reconciled — provider capture already existed.",
  capture_resumed: "Capture safely resumed using the original command.",
  payment_captured: "Provider confirms payment captured.",
  manual_resolution_required: "Safe automatic replay cannot be established; manual resolution required.",
  payment_not_eligible: "Payment is no longer eligible for capture.",
  provider_ambiguous: "Provider state could not be determined; manual resolution required.",
  capture_pending: "Capture submitted — awaiting provider confirmation.",
} as const;
const safeError = (error: unknown): Readonly<{ name: string; message: string }> => {
  if (error instanceof Error) return Object.freeze({ name: error.name || "Error", message: error.message || "Unknown error" });
  return Object.freeze({ name: "UnknownError", message: "Non-Error value thrown" });
};

export const handleOperationsRequest = async (request: Request, service: OperationsService, principal?: OperationsPrincipal, returns?: ReturnService): Promise<Response> => {
  if (!validPrincipal(principal)) return json({ message: "Authentication required." }, 401);
  const url = new URL(request.url); const path = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (path[0] === "operations") path.shift();
  try {
    if (path[0] === "orders" && path[1] && path[2] === "returns") {
      if (request.method === "POST" && path.length === 5 && path[3] && path[4] === "refund") {
        if (!allowed(principal, "returns:approve") || !allowed(principal, "refunds:create")) return json({ message: "Permission denied." }, 403);
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "expectedVersion")) throw new OperationsError("invalid_request", "Only the expected return version may be supplied.");
        return json(await service.refundReturn({ orderId: path[1], returnId: path[3], expectedVersion: (body as { expectedVersion: number }).expectedVersion, operatorId: principal.id, idempotencyKey: request.headers.get("idempotency-key") ?? "" }), 201);
      }
      if (!returns) return json({ message: "Not found." }, 404);
      if (request.method === "GET" && path.length === 3) {
        if (!allowed(principal, "orders:read")) return json({ message: "Permission denied." }, 403);
        return json({ returns: await returns.list(path[1]) });
      }
      if (request.method === "POST" && path.length === 3) {
        if (!allowed(principal, "returns:manage")) return json({ message: "Permission denied." }, 403);
        return json(await returns.request(path[1], await request.json(), principal.id, request.headers.get("idempotency-key") ?? ""), 201);
      }
      if (request.method === "POST" && path.length === 5 && path[3] && path[4] && ["approve", "reject", "cancel", "receive", "inspect", "close"].includes(path[4])) {
        const permission = ["approve", "reject", "close"].includes(path[4]) ? "returns:approve" : "returns:manage";
        if (!allowed(principal, permission)) return json({ message: "Permission denied." }, 403);
        return json(await returns.act(path[1], path[3], path[4] as ReturnAction, await request.json(), principal.id, request.headers.get("idempotency-key") ?? ""));
      }
      return json({ message: "Not found." }, 404);
    }
    if (request.method === "POST" && path[0] === "orders" && path[1] && path[2] === "capture" && path[3] === "reconcile" && path.length === 4) {
      if (!allowed(principal, "payments:capture")) return json({ message: "Permission denied." }, 403);
      const result = await service.reconcileCapture(path[1], principal.id);
      return json({ ...result, message: captureReconciliationMessages[result.outcome] }, ["pending", "resolution_required"].includes(result.status) ? 202 : 200);
    }
    if (request.method === "POST" && path[0] === "orders" && path[1] && path[2] === "capture" && path.length === 3) {
      if (!allowed(principal, "payments:capture")) return json({ message: "Permission denied." }, 403);
      const result = await service.capture({ orderId: path[1], operatorId: principal.id, idempotencyKey: request.headers.get("idempotency-key") ?? "" });
      return json({ ...result, ...(result.status === "pending" ? { message: captureReconciliationMessages.capture_pending } : {}) }, result.status === "completed" ? 200 : result.status === "failed" ? 502 : 202);
    }
    if (request.method === "GET" && path[0] === "orders" && path.length === 1) {
      if (!allowed(principal, "orders:read")) return json({ message: "Permission denied." }, 403);
      return json({ orders: await service.search(url.searchParams.get("q") ?? "") });
    }
    if (request.method === "GET" && path[0] === "orders" && path[1]) {
      if (!allowed(principal, "orders:read")) return json({ message: "Permission denied." }, 403);
      const details = await service.details(path[1]); return details ? json(details) : json({ message: "Order not found." }, 404);
    }
    if (request.method === "POST" && path[0] === "orders" && path[1] && path[2] === "refunds") {
      if (!allowed(principal, "refunds:create")) return json({ message: "Permission denied." }, 403);
      const key=request.headers.get("idempotency-key")?.trim(); if(!key||key.length>128)return json({message:"A valid idempotency key is required."},400);
      const body=await request.json() as {amountMinor?:number;reason?:RefundReason};
      return json(await service.refund({orderId:path[1],amountMinor:body.amountMinor??0,reason:body.reason as RefundReason,operatorId:principal.id,idempotencyKey:key}),201);
    }
    if (request.method === "POST" && path[0] === "outbox" && path[1] && path[2] === "retry") {
      if (!allowed(principal, "fulfilment:retry")) return json({ message: "Permission denied." }, 403);
      const key=request.headers.get("idempotency-key")?.trim(); if(!key||key.length>128)return json({message:"A valid idempotency key is required."},400);
      return json(await service.retry(path[1],principal.id,key));
    }
    if (request.method === "GET" && path[0] === "reconciliation.csv") {
      if (!allowed(principal, "reconciliation:export")) return json({ message: "Permission denied." }, 403);
      const from=url.searchParams.get("from")??"", to=url.searchParams.get("to")??"";
      const start=Date.parse(from),end=Date.parse(to); if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>31*86400000)return json({message:"A valid range of no more than 31 days is required."},400);
      const body=csv(await service.reconciliation(new Date(start).toISOString(),new Date(end).toISOString()));
      return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=cyph1-reconciliation.csv",...securityHeaders}});
    }
    return json({ message: "Not found." }, 404);
  } catch(error) {
    if(error instanceof ReturnDomainError)return json({message:error.message,code:error.code},{invalid_request:400,not_found:404,conflict:409}[error.code]);
    if(error instanceof SyntaxError)return json({message:"Invalid JSON request."},400);
    if(error instanceof OperationsError)return json({message:error.message,code:error.code},{invalid_request:400,not_found:404,conflict:409,provider_error:502}[error.code]);
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "operations_handler_error", error: safeError(error) }));
    return json({message:"The operations request could not be completed."},500);
  }
};
