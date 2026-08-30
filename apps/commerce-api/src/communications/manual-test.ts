import { createHash } from "node:crypto";
import type { TransactionalCommunicationProvider, TransactionalMessage } from "../../../../packages/commerce-core/src/index.js";
export class ManualTestCommunicationProvider implements TransactionalCommunicationProvider {
  readonly key = "manual-test";
  async send(message: TransactionalMessage) {
    const reference = createHash("sha256").update(message.idempotencyKey).digest("hex").slice(0, 24);
    return Object.freeze({ providerReference: `manual-${reference}`, acceptedAt: new Date().toISOString() });
  }
}
