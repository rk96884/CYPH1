import { createHash, randomUUID } from "node:crypto";
import { money, PaymentProviderError, type CaptureInput, type NormalisedCapture, type NormalisedPayment, type PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";
import { providerTimestamp } from "../payments/capture-deadline.js";

export const operationPermissions = ["orders:read", "payments:capture", "refunds:create", "fulfilment:retry", "reconciliation:export"] as const;
export type OperationPermission = typeof operationPermissions[number];
export type OperationsPrincipal = Readonly<{ id: string; permissions: readonly OperationPermission[] }>;
export type RefundReason = "customer_request" | "cancelled_order" | "returned_goods" | "operator_correction";

export type OrderSummary = Readonly<{ id: string; orderNumber: string; status: string; fulfilmentStatus: string; currency: string; totalMinor: number; createdAt: string }>;
export type TimelineEvent = Readonly<{ id: string; type: string; action: string; status?: string; occurredAt: string; summary: Readonly<Record<string, unknown>> }>;
export type OrderDetails = Readonly<{ order: OrderSummary; payments: readonly Readonly<Record<string, unknown>>[]; refunds: readonly Readonly<Record<string, unknown>>[]; fulfilments: readonly Readonly<Record<string, unknown>>[]; timeline: readonly TimelineEvent[]; captureCommand?: Readonly<{ status: string }> }>;
export type RefundReservation = Readonly<{ outcome: "reserved" | "replayed"; refundId: string; paymentId: string; provider: string; providerPaymentId: string; currency: string; amountMinor: number; refundableMinor: number; result?: Readonly<Record<string, unknown>> }>;

export type CaptureCommand = Readonly<{ orderId: string; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>;
export type CaptureResult = Readonly<{ status: "completed" | "failed" | "resolution_required"; providerCaptureId?: string }>;
export type CaptureReservation = Readonly<{ outcome: "reserved"; paymentId: string; provider: string; providerPaymentId: string; amountMinor: number; currency: string }> | Readonly<{ outcome: "replayed"; result: CaptureResult }>;
export type CaptureReconciliationResult = CaptureResult & Readonly<{
  outcome: "capture_reconciled" | "capture_resumed" | "payment_captured" | "payment_not_eligible" | "manual_resolution_required" | "provider_ambiguous" | "capture_pending";
  captures?: readonly NormalisedCapture[];
}>;
export type CaptureRecovery = Readonly<{
  orderId: string; paymentId: string; provider: string; providerPaymentId: string; amountMinor: number; currency: string;
  idempotencyKey: string; fingerprint: string; originalOperatorId: string; request: CaptureInput | null;
  firstAttemptAt: string | null; providerContext: string | null; revision: string; claimId: string;
}>;
export type CaptureRecoveryReservation = Readonly<{ outcome: "reserved"; recovery: CaptureRecovery }> | Readonly<{ outcome: "replayed"; result: CaptureReconciliationResult }>;
export interface OperationsRepository {
  reserveCapture(input: CaptureCommand): Promise<CaptureReservation>;
  refreshCapture(input: CaptureCommand & { paymentId: string; payment: NormalisedPayment; now: Date }): Promise<boolean>;
  finishCapture(input: CaptureCommand & { paymentId: string; result: CaptureResult }): Promise<CaptureResult>;
  prepareCaptureAttempt(input: CaptureCommand & { paymentId: string; request: CaptureInput; providerContext: string | null }): Promise<void>;
  reserveCaptureReconciliation(orderId: string, operatorId: string, claimId: string): Promise<CaptureRecoveryReservation>;
  permitCaptureReplay(recovery: CaptureRecovery, operatorId: string): Promise<boolean>;
  finishCaptureReconciliation(recovery: CaptureRecovery, operatorId: string, result: CaptureReconciliationResult, payment?: NormalisedPayment): Promise<CaptureReconciliationResult>;
  searchOrders(query: string, limit: number): Promise<readonly OrderSummary[]>;
  getOrder(orderId: string): Promise<OrderDetails | undefined>;
  reserveRefund(input: Readonly<{ orderId: string; amountMinor: number; reason: RefundReason; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>): Promise<RefundReservation>;
  completeRefund(input: Readonly<{ refundId: string; providerRefundId: string; status: "pending" | "completed" | "failed"; operatorId: string; correlationId: string }>): Promise<void>;
  failRefund(input: Readonly<{ refundId: string; failureCode: string; operatorId: string; correlationId: string }>): Promise<void>;
  markRefundResolutionRequired(input: Readonly<{ refundId: string; operatorId: string; correlationId: string }>): Promise<void>;
  retryOutbox(input: Readonly<{ eventId: string; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>): Promise<Readonly<{ replayed: boolean; eventId: string }>>;
  reconciliationRows(from: string, to: string, limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
}

export class OperationsError extends Error {
  constructor(readonly code: "invalid_request" | "not_found" | "conflict" | "provider_error", message: string) { super(message); this.name = "OperationsError"; }
}

const fingerprint = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reconciliationDiagnostic = (stage: string, recovery: CaptureRecovery, error: unknown): void => {
  const detail = error instanceof PaymentProviderError
    ? { name: error.name, message: error.message, category: error.category, retryable: error.retryable }
    : error instanceof Error
      ? { name: error.name || "Error", message: error.message || "Unknown error" }
      : { name: "UnknownError", message: "Non-Error value thrown" };
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "capture_reconciliation_provider_error", stage, provider: recovery.provider, claimId: recovery.claimId, error: detail }));
};

export class OperationsService {
  constructor(private readonly repository: OperationsRepository, private readonly providers: PaymentProviderRegistry, private readonly clock: () => Date = () => new Date()) {}
  search(query: string) { return this.repository.searchOrders(query.trim(), 50); }
  details(orderId: string) { return this.repository.getOrder(orderId); }

  async capture(input: Readonly<{ orderId: string; operatorId: string; idempotencyKey: string }>): Promise<CaptureResult> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.idempotencyKey)) throw new OperationsError("invalid_request", "A valid idempotency key is required.");
    const command = { ...input, fingerprint: fingerprint({ command: "payment.capture", ...input }), correlationId: randomUUID() };
    const reservation = await this.repository.reserveCapture(command);
    if (reservation.outcome === "replayed") return reservation.result;
    let result: CaptureResult;
    try {
      const provider = this.providers.getProvider(reservation.provider);
      if (!provider.capture) throw new PaymentProviderError("configuration_error", "Capture is not supported.");
      const amount = money(reservation.amountMinor, reservation.currency);
      const payment = await provider.getPayment({ providerPaymentId: reservation.providerPaymentId, correlationId: command.correlationId });
      if (payment.provider !== reservation.provider || payment.providerPaymentId !== reservation.providerPaymentId ||
          (payment.orderId !== undefined && payment.orderId !== input.orderId) || payment.amount.value !== amount.value || payment.amount.currency !== amount.currency) throw new Error("provider_identity_mismatch");
      providerTimestamp(payment.captureBefore); providerTimestamp(payment.authorisedAt);
      const ready = await this.repository.refreshCapture({ ...command, paymentId: reservation.paymentId, payment, now: this.clock() });
      if (!ready || payment.status !== "authorised" || payment.captureMode === "automatic" ||
          !payment.captureBefore || Date.parse(payment.captureBefore) <= this.clock().getTime()) throw new Error("capture_requires_resolution");
      const request = { ...input, paymentId: reservation.paymentId, providerPaymentId: reservation.providerPaymentId, amount, authorisedAmount: amount, correlationId: command.correlationId };
      await this.repository.prepareCaptureAttempt({ ...command, paymentId: reservation.paymentId, request, providerContext: provider.captureReplayContext?.() ?? null });
      const captured = await provider.capture(request);
      const verified = captured.provider === reservation.provider && captured.providerPaymentId === reservation.providerPaymentId &&
        captured.amount.value === amount.value && captured.amount.currency === amount.currency && !!captured.providerCaptureId;
      result = verified
        ? { status: captured.status === "pending" ? "resolution_required" : captured.status, providerCaptureId: captured.providerCaptureId }
        : { status: "resolution_required" };
    } catch (error) {
      result = { status: error instanceof PaymentProviderError && !error.retryable &&
        ["configuration_error", "authentication_error", "validation_error", "payment_declined"].includes(error.category) ? "failed" : "resolution_required" };
    }
    return this.repository.finishCapture({ ...command, paymentId: reservation.paymentId, result });
  }

  async reconcileCapture(orderId: string, operatorId: string): Promise<CaptureReconciliationResult> {
    const reserved = await this.repository.reserveCaptureReconciliation(orderId, operatorId, randomUUID());
    if (reserved.outcome === "replayed") return reserved.result;
    const recovery = reserved.recovery;
    let result: CaptureReconciliationResult = { status: "resolution_required", outcome: "provider_ambiguous" };
    let verifiedPayment: NormalisedPayment | undefined;
    let stage = "provider_lookup";
    try {
      const provider = this.providers.getProvider(recovery.provider);
      if (!provider.listCaptures) throw new Error("capture_lookup_unavailable");
      stage = "get_payment";
      const payment = await provider.getPayment({ providerPaymentId: recovery.providerPaymentId, correlationId: recovery.claimId });
      stage = "validate_payment";
      if (payment.provider !== recovery.provider || payment.providerPaymentId !== recovery.providerPaymentId ||
          (payment.orderId !== undefined && payment.orderId !== orderId) || payment.amount.value !== recovery.amountMinor || payment.amount.currency !== recovery.currency) throw new Error("payment_mismatch");
      providerTimestamp(payment.captureBefore); providerTimestamp(payment.authorisedAt); providerTimestamp(payment.paidAt);
      stage = "list_captures";
      const listed = await provider.listCaptures({ providerPaymentId: recovery.providerPaymentId, correlationId: recovery.claimId });
      stage = "validate_capture_evidence";
      if (!listed.complete || listed.captures.some((capture) => capture.provider !== recovery.provider || capture.providerPaymentId !== recovery.providerPaymentId ||
          capture.amount.currency !== recovery.currency || capture.amount.value !== recovery.amountMinor || !capture.providerCaptureId || !providerTimestamp(capture.createdAt)) || listed.captures.length > 1) throw new Error("capture_evidence_ambiguous");
      verifiedPayment = payment;
      const capture = listed.captures[0];
      if (capture) {
        const completed = capture.status === "completed" && ["authorised", "captured"].includes(payment.status);
        result = { status: completed ? "completed" : "resolution_required", outcome: completed ? "capture_reconciled" : capture.status === "pending" ? "capture_pending" : "manual_resolution_required", providerCaptureId: capture.providerCaptureId, captures: listed.captures };
      } else if (payment.status === "captured") {
        result = { status: "completed", outcome: "payment_captured" };
      } else if (payment.status !== "authorised") {
        result = { status: "failed", outcome: "payment_not_eligible" };
      } else {
        stage = "validate_replay_evidence";
        const request = recovery.request;
        const evidence = recovery.firstAttemptAt && recovery.providerContext ? { firstAttemptAt: recovery.firstAttemptAt, providerContext: recovery.providerContext } : undefined;
        const safeRequest = request && request.orderId === orderId && request.paymentId === recovery.paymentId && request.providerPaymentId === recovery.providerPaymentId &&
          request.operatorId === recovery.originalOperatorId && request.idempotencyKey === recovery.idempotencyKey &&
          request.amount.value === recovery.amountMinor && request.amount.currency === recovery.currency &&
          request.authorisedAmount.value === recovery.amountMinor && request.authorisedAmount.currency === recovery.currency;
        if (!safeRequest || !evidence || !provider.capture || !provider.canReplayCapture?.(evidence, this.clock()) ||
            payment.captureMode === "automatic" || !payment.captureBefore || Date.parse(payment.captureBefore) <= this.clock().getTime() ||
            !await this.repository.permitCaptureReplay(recovery, operatorId)) {
          result = { status: "resolution_required", outcome: "manual_resolution_required" };
        } else {
          stage = "resume_capture";
          const resumed = await provider.capture({ ...request, correlationId: recovery.claimId, replay: evidence });
          stage = "validate_resumed_capture";
          if (resumed.provider !== recovery.provider || resumed.providerPaymentId !== recovery.providerPaymentId || !resumed.providerCaptureId ||
              resumed.amount.value !== recovery.amountMinor || resumed.amount.currency !== recovery.currency || !providerTimestamp(resumed.createdAt)) throw new Error("capture_mismatch");
          result = { status: resumed.status === "completed" ? "completed" : "resolution_required", outcome: resumed.status === "completed" ? "capture_resumed" : "capture_pending", providerCaptureId: resumed.providerCaptureId, captures: [resumed] };
        }
      }
    } catch (error) {
      reconciliationDiagnostic(stage, recovery, error);
      result = { status: "resolution_required", outcome: "provider_ambiguous" };
      verifiedPayment = undefined;
    }
    return this.repository.finishCaptureReconciliation(recovery, operatorId, result, verifiedPayment);
  }

  async refund(input: Readonly<{ orderId: string; amountMinor: number; reason: RefundReason; operatorId: string; idempotencyKey: string }>) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new OperationsError("invalid_request", "Refund amount must be a positive integer in minor units.");
    if (!(["customer_request", "cancelled_order", "returned_goods", "operator_correction"] as const).includes(input.reason)) throw new OperationsError("invalid_request", "An approved refund reason is required.");
    const correlationId = randomUUID();
    const reservation = await this.repository.reserveRefund({ ...input, fingerprint: fingerprint(input), correlationId });
    if (reservation.outcome === "replayed") return reservation.result;
    try {
      const provider = this.providers.getProvider(reservation.provider);
      const payment = await provider.getPayment({ providerPaymentId: reservation.providerPaymentId, correlationId });
      if (payment.amount.currency !== reservation.currency || payment.refundableAmount.value < reservation.amountMinor) throw new OperationsError("conflict", "The provider no longer reports enough refundable value.");
      const result = await provider.refund({
        paymentId: reservation.paymentId, orderId: input.orderId, providerPaymentId: reservation.providerPaymentId,
        amount: money(reservation.amountMinor, reservation.currency), refundableAmount: payment.refundableAmount,
        reason: input.reason, operatorId: input.operatorId, idempotencyKey: input.idempotencyKey, correlationId,
      });
      await this.repository.completeRefund({ refundId: reservation.refundId, providerRefundId: result.providerRefundId, status: result.status, operatorId: input.operatorId, correlationId });
      return result;
    } catch (error) {
      if (error instanceof PaymentProviderError && error.retryable) {
        await this.repository.markRefundResolutionRequired({ refundId: reservation.refundId, operatorId: input.operatorId, correlationId });
      } else {
        await this.repository.failRefund({ refundId: reservation.refundId, failureCode: error instanceof PaymentProviderError ? error.category : "provider_error", operatorId: input.operatorId, correlationId });
      }
      if (error instanceof OperationsError) throw error;
      throw new OperationsError("provider_error", "The refund provider could not complete the request.");
    }
  }

  retry(eventId: string, operatorId: string, idempotencyKey: string) {
    const correlationId = randomUUID();
    return this.repository.retryOutbox({ eventId, operatorId, idempotencyKey, fingerprint: fingerprint({ eventId, operatorId }), correlationId });
  }
  reconciliation(from: string, to: string) { return this.repository.reconciliationRows(from, to, 5000); }
}
