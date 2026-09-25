import type { CreateFulfilmentRequest, FulfilmentProvider } from "../../../../packages/commerce-core/src/index.js";

/**
 * Production-safe manual fulfilment adapter for low-volume launch.
 * Creates a durable internal reference but performs no external shipping side effect.
 */
export class ManualLiveFulfilmentProvider implements FulfilmentProvider {
  readonly key = "manual-live";

  async create(request: CreateFulfilmentRequest) {
    return Object.freeze({
      providerReference: `manual-live-${request.orderNumber}`,
      status: "accepted" as const,
    });
  }

  async cancel(_providerReference: string, _idempotencyKey: string): Promise<void> {}
  async requestReturn(_providerReference: string, _idempotencyKey: string): Promise<void> {}
}
