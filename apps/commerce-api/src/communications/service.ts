import type { TransactionalCommunicationProvider } from "../../../../packages/commerce-core/src/index.js";
import { renderTransactionalMessage, type CommunicationContext } from "./templates.js";
export interface CommunicationRepository {
  claimNext(): Promise<(CommunicationContext & Readonly<{ deliveryId: string }>) | undefined>;
  markSent(deliveryId: string, provider: string, providerReference: string): Promise<void>;
  markFailed(deliveryId: string, errorCode: string): Promise<void>;
}
export class TransactionalCommunicationConsumer {
  constructor(private readonly enabled: boolean, private readonly repository: CommunicationRepository, private readonly provider: TransactionalCommunicationProvider) {}
  async consumeOne() {
    if (!this.enabled) return Object.freeze({ outcome: "disabled" as const });
    const delivery = await this.repository.claimNext();
    if (!delivery) return Object.freeze({ outcome: "empty" as const });
    try {
      const receipt = await this.provider.send(renderTransactionalMessage(delivery));
      await this.repository.markSent(delivery.deliveryId, this.provider.key, receipt.providerReference);
      return Object.freeze({ outcome: "sent" as const, deliveryId: delivery.deliveryId });
    } catch (error) {
      await this.repository.markFailed(delivery.deliveryId, error instanceof Error ? error.name : "unknown");
      return Object.freeze({ outcome: "failed" as const, deliveryId: delivery.deliveryId });
    }
  }
}
