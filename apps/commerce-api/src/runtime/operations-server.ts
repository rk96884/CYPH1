import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import pg from "pg";
import { createCloudflareAccessAuthenticator, loadCloudflareAccessConfig } from "../access/cloudflare-access.js";
import { createProtectedOperationsHandler } from "../access/protected-operations.js";
import { PostgresOperationsRepository } from "../operations/postgres.js";
import { OperationsService } from "../operations/service.js";
import { createPaymentProviderRegistry } from "../payments/factory.js";
import { createOperationsRuntime, requestHeaders } from "./http.js";

const environment = process.env;
const databaseUrl = environment.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const port = Number(environment.PORT ?? "3000");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: environment.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
});
const access = createCloudflareAccessAuthenticator(loadCloudflareAccessConfig(environment));
const service = new OperationsService(new PostgresOperationsRepository(pool), createPaymentProviderRegistry(environment));
const runtime = createOperationsRuntime(
  createProtectedOperationsHandler(service, access),
  async () => { await pool.query("SELECT 1"); },
);

const readBody = async (request: IncomingMessage): Promise<ArrayBuffer | undefined> => {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const maximum = 64 * 1024;
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

const send = async (response: Response, target: ServerResponse): Promise<void> => {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => target.setHeader(name, value));
  target.end(Buffer.from(await response.arrayBuffer()));
};

const server = createServer(async (incoming, outgoing) => {
  try {
    const body = await readBody(incoming);
    const request = new Request(`https://operations.invalid${incoming.url ?? "/"}`, {
      method: incoming.method ?? "GET",
      headers: requestHeaders(incoming.headers),
      ...(body ? { body } : {}),
    });
    await send(await runtime(request), outgoing);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 500;
    await send(new Response(JSON.stringify({ message: status === 413 ? "Request body is too large." : "The request could not be completed." }), {
      status,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
    }), outgoing);
  }
});

server.listen(port, "0.0.0.0");
const shutdown = (): void => {
  server.close(() => { void pool.end().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
