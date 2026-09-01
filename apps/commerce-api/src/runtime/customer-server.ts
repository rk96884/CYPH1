import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import pg from "pg";
import { handleCheckoutRequest } from "../checkout/handler.js";
import { PostgresCheckoutRepository } from "../checkout/postgres.js";
import { CheckoutService } from "../checkout/service.js";
import { loadCommerceConfig } from "../config.js";
import { createPaymentProviderRegistry } from "../payments/factory.js";
import { handlePaymentWebhookRequest } from "../webhooks/handler.js";
import { PostgresTransactionRunner } from "../webhooks/postgres.js";
import { PaymentWebhookProcessor } from "../webhooks/processor.js";
import { createCustomerRuntime, customerRequestUrl, loadCustomerRouteGates, loadCustomerRuntimeOrigin } from "./customer-http.js";
import { requestHeaders } from "./http.js";
import { createRequestId } from "./observability.js";

const environment = process.env;
const databaseUrl = environment.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const port = Number(environment.PORT ?? "3000");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");
const gates = loadCustomerRouteGates(environment);
const runtimeOrigin = loadCustomerRuntimeOrigin(environment);

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: environment.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});

type CustomerHandler = (request: Request) => Promise<Response>;
const notFound: CustomerHandler = async (_request): Promise<Response> => new Response(JSON.stringify({ message: "Not found." }), {
  status: 404,
  headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
});
let checkout: CustomerHandler = notFound;
let paymentWebhook: CustomerHandler = notFound;

if (gates.checkoutEnabled || gates.paymentWebhooksEnabled) {
  const paymentProvider = createPaymentProviderRegistry(environment).getConfiguredProvider();
  if (gates.checkoutEnabled) {
    const allowedOrigin = environment.PRIVATE_STOREFRONT_ORIGIN?.trim();
    const orderStatusBaseUrl = environment.CHECKOUT_ORDER_STATUS_URL?.trim();
    const cancellationBaseUrl = environment.CHECKOUT_CANCELLATION_URL?.trim();
    const webhookUrl = environment.PAYMENT_WEBHOOK_URL?.trim();
    if (!allowedOrigin || !orderStatusBaseUrl || !cancellationBaseUrl || !webhookUrl) {
      throw new Error("Enabled checkout requires the private storefront origin and all checkout callback URLs.");
    }
    const unitTaxMinor = Number(environment.PRIVATE_CHECKOUT_UNIT_TAX_MINOR ?? "0");
    const service = new CheckoutService(
      loadCommerceConfig(environment),
      new PostgresCheckoutRepository(pool, unitTaxMinor),
      paymentProvider,
      { orderStatusBaseUrl, cancellationBaseUrl, webhookUrl },
      false,
    );
    checkout = (request) => handleCheckoutRequest(request, service, { allowedOrigin });
  }
  if (gates.paymentWebhooksEnabled) {
    const processor = new PaymentWebhookProcessor(paymentProvider, new PostgresTransactionRunner(pool));
    paymentWebhook = (request) => handlePaymentWebhookRequest(request, processor);
  }
}

const runtime = createCustomerRuntime({
  checkout,
  paymentWebhook,
  readiness: async () => { await pool.query("SELECT 1"); },
  gates,
});

const readBody = async (request: IncomingMessage): Promise<ArrayBuffer | undefined> => {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const maximum = 16 * 1024;
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > maximum) throw new RangeError("Request body is too large.");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > maximum) throw new RangeError("Request body is too large.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const combined = Buffer.concat(chunks);
  const body = new Uint8Array(combined.length);
  body.set(combined);
  return body.buffer;
};

const send = async (response: Response, target: ServerResponse, requestId: string): Promise<void> => {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => target.setHeader(name, value));
  target.setHeader("X-Request-ID", requestId);
  target.end(Buffer.from(await response.arrayBuffer()));
};

const server = createServer(async (incoming, outgoing) => {
  const requestId = createRequestId();
  try {
    const body = await readBody(incoming);
    const request = new Request(customerRequestUrl(runtimeOrigin, incoming.url ?? "/"), {
      method: incoming.method ?? "GET",
      headers: requestHeaders(incoming.headers),
      ...(body ? { body } : {}),
    });
    await send(await runtime(request), outgoing, requestId);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 500;
    await send(new Response(JSON.stringify({ message: status === 413 ? "Request body is too large." : "The request could not be completed." }), {
      status,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
    }), outgoing, requestId);
  }
});

server.listen(port, "0.0.0.0");
const shutdown = (): void => {
  server.close(() => { void pool.end().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
