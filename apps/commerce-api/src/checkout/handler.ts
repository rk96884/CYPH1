import { CheckoutError, type CheckoutResult, type CheckoutService, type InitiateCheckoutInput } from "./service.js";

type CheckoutInitiator = Readonly<{ initiate(input: InitiateCheckoutInput): Promise<CheckoutResult> }>;
type CheckoutHttpOptions = Readonly<{ allowedOrigin?: string }>;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const validCheckoutInput = (value: unknown): value is Omit<InitiateCheckoutInput, "idempotencyKey"> => {
  if (!isRecord(value) || !isRecord(value.deliveryAddress)) return false;
  const address = value.deliveryAddress;
  return typeof value.productSlug === "string"
    && typeof value.quantity === "number"
    && typeof value.shippingRateId === "string"
    && typeof value.email === "string"
    && typeof value.correlationId === "string"
    && (value.importChargesAccepted === undefined || typeof value.importChargesAccepted === "boolean")
    && (value.expectedTotalMinor === undefined || Number.isSafeInteger(value.expectedTotalMinor))
    && (value.paymentMethod === undefined || value.paymentMethod === "klarna")
    && typeof address.givenName === "string"
    && typeof address.familyName === "string"
    && typeof address.line1 === "string"
    && (address.line2 === undefined || typeof address.line2 === "string")
    && typeof address.locality === "string"
    && (address.region === undefined || typeof address.region === "string")
    && typeof address.postalCode === "string"
    && typeof address.countryCode === "string";
};

const json = (body: unknown, status: number, headers: Readonly<Record<string, string>> = {}): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
const errorStatus = (error: CheckoutError): number => ({ disabled: 404, invalid_request: 400, unavailable: 409, conflict: 409, provider_error: 502 })[error.code];

export const handleCheckoutRequest = async (request: Request, checkout: CheckoutInitiator, options: CheckoutHttpOptions = {}): Promise<Response> => {
  const origin = request.headers.get("origin");
  const corsHeaders: Record<string, string> = options.allowedOrigin && origin === options.allowedOrigin ? { "Access-Control-Allow-Origin": options.allowedOrigin, Vary: "Origin" } : {};
  if (origin && options.allowedOrigin && origin !== options.allowedOrigin) return json({ message: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key", "Access-Control-Max-Age": "600" } });
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { ...corsHeaders, Allow: "POST, OPTIONS" });
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!contentType.startsWith("application/json") || (Number.isFinite(contentLength) && contentLength > 16_384)) return json({ message: "Invalid request." }, 400, corsHeaders);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!idempotencyKey || idempotencyKey.length > 128) return json({ message: "A valid idempotency key is required." }, 400, corsHeaders);
  let parsed: unknown;
  try { parsed = await request.json(); } catch { return json({ message: "Invalid request." }, 400, corsHeaders); }
  if (!validCheckoutInput(parsed)) return json({ message: "Invalid request." }, 400, corsHeaders);
  try {
    const result = await checkout.initiate({ ...parsed, idempotencyKey });
    return json(result, result.replayed ? 200 : 201, corsHeaders);
  } catch (error) {
    if (error instanceof CheckoutError) return json({ message: error.message, code: error.code }, errorStatus(error), corsHeaders);
    return json({ message: "Checkout could not be started." }, 500, corsHeaders);
  }
};

/** Quote and payment creation share the same request bounds, origin and admission gate. */
export const handleCheckoutQuoteRequest = async (request: Request, service: Pick<CheckoutService, "quote">, options: CheckoutHttpOptions = {}): Promise<Response> => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = options.allowedOrigin && origin === options.allowedOrigin ? { "Access-Control-Allow-Origin": options.allowedOrigin, Vary: "Origin" } : {};
  if (origin && options.allowedOrigin && origin !== options.allowedOrigin) return json({ message: "Origin not allowed." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, { ...headers, Allow: "POST, OPTIONS" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ message: "Invalid request." }, 400, headers);
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 16_384) return json({ message: "Invalid request." }, 400, headers);
    let input: unknown;
    try { input = JSON.parse(body); } catch { return json({ message: "Invalid request." }, 400, headers); }
    if (!isRecord(input) || typeof input.productSlug !== "string" || typeof input.quantity !== "number" || typeof input.countryCode !== "string") return json({ message: "Invalid request." }, 400, headers);
    return json(await service.quote({ productSlug: input.productSlug, quantity: input.quantity, countryCode: input.countryCode }), 200, headers);
  } catch (error) {
    if (error instanceof CheckoutError) return json({ message: error.message, code: error.code }, errorStatus(error), headers);
    return json({ message: "Shipping quote is unavailable." }, 500, headers);
  }
};
