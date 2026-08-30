import { CommerceDomainError } from "./errors.js";

export type FulfilmentStatus =
  | "created" | "queued" | "accepted" | "dispatched" | "delivered"
  | "cancelled" | "returned" | "failed";

export type OrderFulfilmentStatus =
  | "unfulfilled" | "queued" | "processing" | "dispatched"
  | "delivered" | "cancelled" | "returned";

const transitions: Record<FulfilmentStatus, readonly FulfilmentStatus[]> = {
  created: ["queued", "accepted", "cancelled", "failed"],
  queued: ["accepted", "cancelled", "failed"],
  accepted: ["dispatched", "cancelled", "failed"],
  dispatched: ["delivered", "returned", "failed"],
  delivered: ["returned"],
  cancelled: [], returned: [], failed: [],
};

export type FulfilmentTransition = Readonly<{
  status: FulfilmentStatus;
  outcome: "applied" | "ignored" | "requires_review";
}>;

export const transitionFulfilment = (current: FulfilmentStatus, next: FulfilmentStatus): FulfilmentTransition => {
  if (current === next) return Object.freeze({ status: current, outcome: "ignored" });
  if (transitions[current].includes(next)) return Object.freeze({ status: next, outcome: "applied" });
  if (transitions[next].includes(current) || ["cancelled", "returned"].includes(current)) {
    return Object.freeze({ status: current, outcome: "ignored" });
  }
  return Object.freeze({ status: current, outcome: "requires_review" });
};

export const orderFulfilmentStatusFor = (status: FulfilmentStatus): OrderFulfilmentStatus => ({
  created: "queued", queued: "queued", accepted: "processing", dispatched: "dispatched",
  delivered: "delivered", cancelled: "cancelled", returned: "returned", failed: "unfulfilled",
})[status] as OrderFulfilmentStatus;

export type FulfilmentAddress = Readonly<{
  recipientName: string; line1: string; line2?: string; locality: string;
  region?: string; postalCode: string; countryCode: string; phone?: string;
}>;
export type FulfilmentLine = Readonly<{ sku: string; quantity: number }>;
export type CreateFulfilmentRequest = Readonly<{
  idempotencyKey: string; orderId: string; orderNumber: string;
  deliveryAddress: FulfilmentAddress; lines: readonly FulfilmentLine[];
}>;
export type CreateFulfilmentResult = Readonly<{
  providerReference: string; status: "queued" | "accepted";
}>;
export type FulfilmentProviderEvent = Readonly<{
  eventId: string; providerReference: string;
  status: "accepted" | "dispatched" | "delivered" | "cancelled" | "returned" | "failed";
  trackingCarrier?: string; trackingReference?: string; failureCode?: string;
}>;

export interface FulfilmentProvider {
  readonly key: string;
  create(request: CreateFulfilmentRequest): Promise<CreateFulfilmentResult>;
  cancel(providerReference: string, idempotencyKey: string): Promise<void>;
  requestReturn(providerReference: string, idempotencyKey: string): Promise<void>;
}

export const assertFulfilmentRequest = (request: CreateFulfilmentRequest): void => {
  if (!request.orderId || !request.orderNumber || !request.idempotencyKey) {
    throw new CommerceDomainError("invalid_fulfilment_request", "A fulfilment request requires stable order identifiers.");
  }
  if (request.lines.length === 0 || request.lines.some((line) => !line.sku || !Number.isInteger(line.quantity) || line.quantity <= 0)) {
    throw new CommerceDomainError("invalid_fulfilment_lines", "Fulfilment lines require a SKU and positive integer quantity.");
  }
  if (!/^[A-Z]{2}$/.test(request.deliveryAddress.countryCode)) {
    throw new CommerceDomainError("invalid_fulfilment_country", "The delivery country must use an uppercase ISO alpha-2 code.");
  }
};
