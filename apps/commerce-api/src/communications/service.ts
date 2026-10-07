import type { TransactionalCommunicationProvider } from "../../../../packages/commerce-core/src/index.js";
import { renderTransactionalMessage, type CommunicationContext } from "./templates.js";
import { CommunicationFailure } from "./failure.js";
export interface CommunicationRepository {
  claimNext(): Promise<(CommunicationContext & Readonly<{ deliveryId: string; claimToken: string }>) | undefined>;
  beginSend(deliveryId: string, claimToken: string): Promise<void>;
  markSent(deliveryId: string, provider: string, providerReference: string, claimToken: string): Promise<void>;
  markFailed(deliveryId: string, errorCode: string, claimToken: string, permanent?: boolean): Promise<void>;
  markReview(deliveryId: string, errorCode: string, claimToken: string, acceptance?: Readonly<{ provider: string; reference: string }>): Promise<void>;
}
export const defaultCommunicationAutomaticRetryLimit = 3;
export const defaultCommunicationClaimLeaseSeconds = 300;
export class TransactionalCommunicationConsumer {
  constructor(private readonly enabled: boolean, private readonly repository: CommunicationRepository, private readonly provider: TransactionalCommunicationProvider) {}
  async consumeOne() {
    if (!this.enabled) return Object.freeze({ outcome: "disabled" as const });
    const delivery = await this.repository.claimNext();
    if (!delivery) return Object.freeze({ outcome: "empty" as const });
    let started = false;
    let acceptance: Readonly<{ provider: string; reference: string }> | undefined;
    try {
      const message = renderTransactionalMessage(delivery);
      await this.repository.beginSend(delivery.deliveryId, delivery.claimToken);
      started = true;
      let receipt;
      try { receipt = await this.provider.send(message); }
      catch (error) {
        if (error instanceof CommunicationFailure && error.kind !== "ambiguous") {
          await this.repository.markFailed(delivery.deliveryId, error.code, delivery.claimToken, error.kind === "permanent");
          return Object.freeze({ outcome: "failed" as const, deliveryId: delivery.deliveryId });
        }
        throw error;
      }
      acceptance = { provider: this.provider.key, reference: receipt.providerReference };
      await this.repository.markSent(delivery.deliveryId, this.provider.key, receipt.providerReference, delivery.claimToken);
      return Object.freeze({ outcome: "sent" as const, deliveryId: delivery.deliveryId });
    } catch {
      // Never record an uncertain provider call or accepted-send DB failure as retryable.
      if (started) await this.repository.markReview(delivery.deliveryId, "send_uncertain", delivery.claimToken, acceptance);
      else await this.repository.markFailed(delivery.deliveryId, "pre_send_failure", delivery.claimToken);
      return Object.freeze({ outcome: started ? "manual_review" as const : "failed" as const, deliveryId: delivery.deliveryId });
    }
  }
}
