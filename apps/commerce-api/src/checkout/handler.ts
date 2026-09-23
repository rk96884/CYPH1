import { CheckoutError, type CheckoutResult, type InitiateCheckoutInput } from "./service.js";

type CheckoutInitiator = Readonly<{ initiate(input: InitiateCheckoutInput): Promise<CheckoutResult> }>;
type CheckoutHttpOptions = Readonly<{ allowedOrigin?: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validCheckoutInput = (value: unknown): value is Omit<InitiateCheckoutInput, "idempotencyKey"> => {
  if (!isRecord(value) || !isRecord(value.deliveryAddress)) return false;
  const address = value.deliveryAddress;
  return typeof value.productSlug === "string"
    && typeof value.quantity === "number"
    && typeof value.shippingRateId === "string"
    && typeof value.email === "string"
    && typeof value.correlationId === "string"
    && typeof address.recipientName === "string"
    && typeof address.line1 === "string"
    && (address.line2 === undefined || typeof address.line2 === "string")
    && typeof address.locality === "string"
    && (address.region === undefined || typeof address.region === "string")
    && typeof address.postalCode === "string"
    && typeof address.countryCode === "string";
};

const json = (body: unknown, status: number, headers: Readonly<Record<string, string>> = {}): Response => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
});

const errorStatus = (error: CheckoutError): number => ({
  disabled: 404,
  invalid_request: 400,
  unavailable: 409,
  conflict: 409,
  provider_error: 502,
})[error.code];

export const handleCheckoutRequest = async (
  request: Request,
  checkout: CheckoutInitiator,
  options: CheckoutHttpOptions = {},
): Promise<Response> => {
  const origin = request.headers.get("origin");
  const corsHeaders: Record<string, string> = options.allowedOrigin && origin === options.allowedOrigin
    ? { "Access-Control-Allow-Origin": options.allowedOrigin, Vary: "Origin" }
    : {};
  if (origin && options.allowedOrigin && origin !== options.allowedOrigin) {
    return json({ message: "Origin not allowed." }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
        "Access-Control-Max-Age": "600",
      },
    });
  }
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { ...corsHeaders, Allow: "POST, OPTIONS" });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!contentType.startsWith("application/json") || (Number.isFinite(contentLength) && contentLength > 16_384)) {
    return json({ message: "Invalid request." }, 400, corsHeaders);
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > 128) return json({ message: "A valid idempotency key is required." }, 400, corsHeaders);
  let parsed: unknown;
  try { parsed = await request.json(); }
  catch { return json({ message: "Invalid request." }, 400, corsHeaders); }
  if (!validCheckoutInput(parsed)) return json({ message: "Invalid request." }, 400, corsHeaders);
  const input = parsed;

  try {
    const result = await checkout.initiate({ ...input, idempotencyKey });
    return json(result, result.replayed ? 200 : 201, corsHeaders);
  } catch (error) {
    if (error instanceof CheckoutError) return json({ message: error.message, code: error.code }, errorStatus(error), corsHeaders);
    return json({ message: "Checkout could not be started." }, 500, corsHeaders);
  }
};
