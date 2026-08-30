import { OperationsError, type OperationPermission, type OperationsPrincipal, type OperationsService, type RefundReason } from "./service.js";

const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const allowed = (principal: OperationsPrincipal | undefined, permission: OperationPermission): principal is OperationsPrincipal => !!principal?.permissions.includes(permission);
const safeCsv = (value: unknown): string => {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const csv = (rows: readonly Readonly<Record<string, unknown>>[]): string => {
  const columns = ["order_number","created_at","order_status","fulfilment_status","currency","total_minor","provider","provider_payment_id","payment_status","amount_minor","refunded_minor","fulfilment_reference","fulfilment_record_status"];
  return [columns.map(safeCsv).join(","), ...rows.map((row) => columns.map((column) => safeCsv(row[column])).join(","))].join("\r\n");
};

export const handleOperationsRequest = async (request: Request, service: OperationsService, principal?: OperationsPrincipal): Promise<Response> => {
  if (!principal) return json({ message: "Authentication required." }, 401);
  const url = new URL(request.url); const path = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (path[0] === "operations") path.shift();
  try {
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
      return new Response(body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=cyph1-reconciliation.csv","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    return json({ message: "Not found." }, 404);
  } catch(error) {
    if(error instanceof SyntaxError)return json({message:"Invalid JSON request."},400);
    if(error instanceof OperationsError)return json({message:error.message,code:error.code},{invalid_request:400,not_found:404,conflict:409,provider_error:502}[error.code]);
    return json({message:"The operations request could not be completed."},500);
  }
};
