import pg from "pg";

export type PublicOrderState = "pending" | "paid" | "cancelled";
type Queryable = Pick<pg.Pool, "query">;

export class PostgresOrderStatusRepository {
  constructor(private readonly pool: Queryable) {}

  async getPublicState(orderId: string): Promise<PublicOrderState | undefined> {
    const result = await this.pool.query("SELECT status FROM orders WHERE id = $1", [orderId]);
    if (result.rowCount !== 1) return undefined;
    const status = String(result.rows[0].status);
    if (status === "draft" || status === "pending_payment") return "pending";
    if (status === "paid" || status === "partially_refunded" || status === "refunded") return "paid";
    if (status === "cancelled") return "cancelled";
    throw new Error("Unexpected order status.");
  }
}

const headers = (origin: string | null, allowedOrigin: string): Record<string, string> => ({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  ...(origin === allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
});

export const handleOrderStatusRequest = async (
  request: Request,
  repository: Pick<PostgresOrderStatusRepository, "getPublicState">,
  allowedOrigin: string,
): Promise<Response> => {
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ message: "Origin not allowed." }), { status: 403, headers: headers(origin, allowedOrigin) });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed." }), { status: 405, headers: { ...headers(origin, allowedOrigin), Allow: "GET" } });
  }
  const match = new URL(request.url).pathname.match(/^\/orders\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/status$/i);
  if (!match) return new Response(JSON.stringify({ message: "Not found." }), { status: 404, headers: headers(origin, allowedOrigin) });
  const state = await repository.getPublicState(match[1]!);
  if (!state) return new Response(JSON.stringify({ message: "Not found." }), { status: 404, headers: headers(origin, allowedOrigin) });
  return new Response(JSON.stringify({ state }), { status: 200, headers: headers(origin, allowedOrigin) });
};
