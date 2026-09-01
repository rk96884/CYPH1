import type { VerifyWebhookInput } from "../../../../packages/commerce-core/src/index.js";
import type { WebhookProcessingResult } from "./processor.js";

type WebhookProcessor = Readonly<{
  process(input: VerifyWebhookInput): Promise<WebhookProcessingResult>;
}>;

const maximumWebhookBytes = 2_048;
const json = (body: unknown, status: number, headers: Readonly<Record<string, string>> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", ...headers },
  });

export const handlePaymentWebhookRequest = async (
  request: Request,
  processor: WebhookProcessor,
): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, { Allow: "POST" });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumWebhookBytes) {
    return json({ message: "Request body is too large." }, 413);
  }
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength > maximumWebhookBytes) {
    return json({ message: "Request body is too large." }, 413);
  }
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => { headers[name] = value; });
  try {
    const result = await processor.process({ rawBody, headers, endpointUrl: request.url });
    if (result.acknowledgement === "rejected") return json({ received: false }, 400);
    return json({ received: true }, 200);
  } catch {
    return json({ message: "Webhook processing is temporarily unavailable." }, 502);
  }
};
