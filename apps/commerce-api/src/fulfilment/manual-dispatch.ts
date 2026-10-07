import { createHash, randomUUID } from "node:crypto";
import type { FulfilmentAddress } from "../../../../packages/commerce-core/src/index.js";

export class ManualDispatchError extends Error {
  constructor(readonly code: "invalid_request" | "not_found" | "conflict", message: string) { super(message); this.name = "ManualDispatchError"; }
}
export type PackingInformation = Readonly<{
  orderId: string; orderNumber: string; orderStatus: string; fulfilmentStatus: string;
  captured: boolean; eligible: boolean;
  address: FulfilmentAddress;
  items: readonly Readonly<{ name: string; sku: string; quantity: number }>[];
  shipments: readonly Readonly<{ id: string; provider: string; status: string; carrier: string | null; service: string | null; reference: string | null; trackingUrl: string | null; dispatchedAt: string | null }>[];
}>;
export type ManualDispatchCommand = Readonly<{
  orderId: string; fulfilmentId: string; operatorId: string; idempotencyKey: string;
  carrier: string; service: string; trackingReference: string; trackingUrl?: string;
  handoverConfirmed: true; fingerprint: string; correlationId: string;
}>;
export type ManualDispatchResult = Readonly<{ orderId: string; fulfilmentId: string; status: "dispatched"; dispatchedAt: string }>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, field: string, maximum: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new ManualDispatchError("invalid_request", `A valid ${field} is required.`);
  return value.trim();
};
export const trackingHttpsUrl = (value: unknown): string | undefined => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 2048 || !/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value) || /%0[ad]/i.test(value)) throw new ManualDispatchError("invalid_request", "Tracking URL must be a valid public HTTPS URL.");
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
        !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host)) throw new Error();
    return url.href;
  } catch { throw new ManualDispatchError("invalid_request", "Tracking URL must be a valid public HTTPS URL."); }
};
export const manualDispatchCommand = (orderId: string, body: unknown, operatorId: string, idempotencyKey: string): ManualDispatchCommand => {
  if (!uuid.test(orderId) || !operatorId.trim() || operatorId.length > 254 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)) throw new ManualDispatchError("invalid_request", "Valid order, operator and idempotency identifiers are required.");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ManualDispatchError("invalid_request", "Dispatch details are required.");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => !["fulfilmentId", "carrier", "service", "trackingReference", "trackingUrl", "handoverConfirmed"].includes(key)) ||
      typeof value.fulfilmentId !== "string" || !uuid.test(value.fulfilmentId) || value.handoverConfirmed !== true) throw new ManualDispatchError("invalid_request", "Select a fulfilment and explicitly confirm physical handover.");
  const trackingUrl = trackingHttpsUrl(value.trackingUrl);
  const details = { orderId: orderId.toLowerCase(), fulfilmentId: value.fulfilmentId.toLowerCase(), operatorId,
    carrier: text(value.carrier, "carrier", 100), service: text(value.service, "service", 100),
    trackingReference: text(value.trackingReference, "tracking reference", 200), ...(trackingUrl ? { trackingUrl } : {}), handoverConfirmed: true as const };
  return { ...details, idempotencyKey, fingerprint: createHash("sha256").update(JSON.stringify({ command: "fulfilment.dispatch", ...details })).digest("hex"), correlationId: randomUUID() };
};
// New checkout snapshots are authoritative; retain support for historical snapshots.
export const fulfilmentAddress = (value: Record<string, unknown>): FulfilmentAddress => ({
  recipientName: typeof value.givenName === "string" && typeof value.familyName === "string"
    ? [value.givenName.trim(), value.familyName.trim()].filter(Boolean).join(" ") : String(value.recipientName ?? ""),
  line1: String(value.line1 ?? ""), ...(value.line2 ? { line2: String(value.line2) } : {}),
  locality: String(value.locality ?? ""), ...(value.region ? { region: String(value.region) } : {}),
  postalCode: String(value.postalCode ?? ""), countryCode: String(value.countryCode ?? ""),
  ...(value.phone ? { phone: String(value.phone) } : {}),
});
