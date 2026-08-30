import type { CreateFulfilmentRequest, FulfilmentProvider } from "../../../../packages/commerce-core/src/index.js";

/** Non-production adapter: records deterministic references and performs no external side effect. */
export class ManualTestFulfilmentProvider implements FulfilmentProvider {
  readonly key = "manual-test";
  async create(request: CreateFulfilmentRequest) {
    return Object.freeze({ providerReference: `manual-${request.orderNumber}`, status: "accepted" as const });
  }
  async cancel(_providerReference: string, _idempotencyKey: string): Promise<void> {}
  async requestReturn(_providerReference: string, _idempotencyKey: string): Promise<void> {}
}
