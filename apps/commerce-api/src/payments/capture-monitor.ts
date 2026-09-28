import { randomUUID } from "node:crypto";
import type { NormalisedPayment, PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";
import { providerTimestamp, type CaptureDeadlineConfig, type CaptureDeadlineState } from "./capture-deadline.js";

export type CaptureMonitorClaim = Readonly<{
  id: string; orderId: string; provider: string; providerPaymentId: string | null;
  amountMinor: number; currency: string; revision: string; claimId: string;
}>;
export type CaptureMonitorObservation = Readonly<{ payment: NormalisedPayment }> | Readonly<{ failure: "provider_verification_failed" }>;
export type CaptureMonitorSummary = Readonly<{ conditions: Partial<Record<CaptureDeadlineState, number>>; remaining: number }>;
export interface CaptureMonitorRepository {
  claim(runStartedAt: Date, now: Date, claimId: string): Promise<CaptureMonitorClaim | undefined>;
  record(claim: CaptureMonitorClaim, observation: CaptureMonitorObservation, config: CaptureDeadlineConfig, now: Date, runId: string): Promise<"recorded" | "alerted" | "conflict">;
  summary(runStartedAt: Date, now: Date, config: CaptureDeadlineConfig): Promise<CaptureMonitorSummary>;
}

export class CaptureDeadlineMonitor {
  constructor(private readonly repository: CaptureMonitorRepository, private readonly providers: PaymentProviderRegistry,
    private readonly config: CaptureDeadlineConfig, private readonly clock: () => Date = () => new Date()) {}

  async run(runId = randomUUID()) {
    const startedAt = this.clock();
    let checked = 0; let eventsCreated = 0; let conflicts = 0;
    for (; checked < this.config.maxPayments; checked++) {
      const claim = await this.repository.claim(startedAt, this.clock(), randomUUID());
      if (!claim) break;
      let observation: CaptureMonitorObservation;
      try {
        if (!claim.providerPaymentId) throw new Error("missing_provider_reference");
        const payment = await this.providers.getProvider(claim.provider).getPayment({ providerPaymentId: claim.providerPaymentId, correlationId: runId });
        if (payment.provider !== claim.provider || payment.providerPaymentId !== claim.providerPaymentId ||
            (payment.orderId !== undefined && payment.orderId !== claim.orderId) || payment.amount.value !== claim.amountMinor || payment.amount.currency !== claim.currency) throw new Error("provider_identity_mismatch");
        providerTimestamp(payment.captureBefore); providerTimestamp(payment.authorisedAt);
        if (payment.captureMode !== undefined && !["manual", "automatic"].includes(payment.captureMode)) throw new Error("invalid_capture_mode");
        observation = { payment };
      } catch {
        // Never log or persist provider error messages, customer fields or credentials.
        observation = { failure: "provider_verification_failed" };
      }
      const result = await this.repository.record(claim, observation, this.config, this.clock(), runId);
      if (result === "alerted") eventsCreated++;
      if (result === "conflict") conflicts++;
    }
    const summary = await this.repository.summary(startedAt, this.clock(), this.config);
    const actionable = conflicts > 0 || summary.remaining > 0 || Object.entries(summary.conditions).some(([condition, count]) => condition !== "safe" && count > 0);
    return { runId, checked, eventsCreated, conflicts, ...summary, actionable };
  }
}
