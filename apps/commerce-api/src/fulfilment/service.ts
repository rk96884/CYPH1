import { randomUUID } from "node:crypto";
import {
  assertFulfilmentRequest,
  transitionFulfilment,
  type CreateFulfilmentRequest,
  type FulfilmentProvider,
  type FulfilmentProviderEvent,
  type FulfilmentStatus,
} from "../../../../packages/commerce-core/src/index.js";

export type FulfilmentReservation = Readonly<{
  outcome: "reserved" | "duplicate";
  fulfilmentId: string;
  request: CreateFulfilmentRequest;
  providerReference?: string;
}>;

export interface FulfilmentRepository {
  reservePaidOrder(orderId: string, provider: string, idempotencyKey: string, correlationId: string): Promise<FulfilmentReservation>;
  confirmProviderCreation(input: Readonly<{ fulfilmentId: string; providerReference: string; status: "queued" | "accepted"; correlationId: string }>): Promise<void>;
  failProviderCreation(fulfilmentId: string, failureCode: string, correlationId: string): Promise<void>;
  applyProviderEvent(provider: string, event: FulfilmentProviderEvent, correlationId: string): Promise<"applied" | "ignored" | "duplicate" | "requires_review">;
  getFulfilment(providerReference: string): Promise<Readonly<{ status: FulfilmentStatus }> | undefined>;
}

export class FulfilmentError extends Error {
  constructor(readonly code: "disabled" | "not_paid" | "not_found" | "requires_review", message: string) {
    super(message); this.name = "FulfilmentError";
  }
}

export class FulfilmentService {
  constructor(
    private readonly enabled: boolean,
    private readonly provider: FulfilmentProvider,
    private readonly repository: FulfilmentRepository,
  ) {}

  async requestForPaidOrder(orderId: string, eventKey: string, correlationId: string = randomUUID()) {
    if (!this.enabled) throw new FulfilmentError("disabled", "Fulfilment is disabled.");
    const idempotencyKey = `fulfilment:${eventKey}`;
    const reservation = await this.repository.reservePaidOrder(orderId, this.provider.key, idempotencyKey, correlationId);
    if (reservation.outcome === "duplicate" && reservation.providerReference) {
      return Object.freeze({ outcome: "duplicate" as const, providerReference: reservation.providerReference });
    }
    assertFulfilmentRequest(reservation.request);
    try {
      const created = await this.provider.create(reservation.request);
      await this.repository.confirmProviderCreation({ fulfilmentId: reservation.fulfilmentId, ...created, correlationId });
      return Object.freeze({ outcome: "created" as const, providerReference: created.providerReference });
    } catch (error) {
      await this.repository.failProviderCreation(reservation.fulfilmentId, "provider_create_failed", correlationId);
      throw error;
    }
  }

  async receiveEvent(event: FulfilmentProviderEvent, correlationId: string = randomUUID()) {
    if (!this.enabled) throw new FulfilmentError("disabled", "Fulfilment is disabled.");
    const existing = await this.repository.getFulfilment(event.providerReference);
    if (!existing) throw new FulfilmentError("not_found", "The fulfilment reference was not found.");
    const transition = transitionFulfilment(existing.status, event.status);
    if (transition.outcome === "requires_review") {
      await this.repository.applyProviderEvent(this.provider.key, event, correlationId);
      throw new FulfilmentError("requires_review", "The fulfilment transition requires manual review.");
    }
    return this.repository.applyProviderEvent(this.provider.key, event, correlationId);
  }

  async requestCancellation(providerReference: string, commandKey: string) {
    if (!this.enabled) throw new FulfilmentError("disabled", "Fulfilment is disabled.");
    const existing = await this.repository.getFulfilment(providerReference);
    if (!existing) throw new FulfilmentError("not_found", "The fulfilment reference was not found.");
    if (transitionFulfilment(existing.status, "cancelled").outcome !== "applied") {
      throw new FulfilmentError("requires_review", "This fulfilment can no longer be cancelled automatically.");
    }
    await this.provider.cancel(providerReference, `cancel:${commandKey}`);
    return Object.freeze({ outcome: "requested" as const });
  }

  async requestReturn(providerReference: string, commandKey: string) {
    if (!this.enabled) throw new FulfilmentError("disabled", "Fulfilment is disabled.");
    const existing = await this.repository.getFulfilment(providerReference);
    if (!existing) throw new FulfilmentError("not_found", "The fulfilment reference was not found.");
    if (transitionFulfilment(existing.status, "returned").outcome !== "applied") {
      throw new FulfilmentError("requires_review", "A return cannot be requested before dispatch.");
    }
    await this.provider.requestReturn(providerReference, `return:${commandKey}`);
    return Object.freeze({ outcome: "requested" as const });
  }
}
