import { createHash, randomUUID } from "node:crypto";
import { money, PaymentProviderError, type PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";

export const operationPermissions = ["orders:read", "payments:capture", "refunds:create", "fulfilment:retry", "reconciliation:export"] as const;
export type OperationPermission = typeof operationPermissions[number];
export type OperationsPrincipal = Readonly<{ id: string; permissions: readonly OperationPermission[] }>;
export type RefundReason = "customer_request" | "cancelled_order" | "returned_goods" | "operator_correction";

export type OrderSummary = Readonly<{ id: string; orderNumber: string; status: string; fulfilmentStatus: string; currency: string; totalMinor: number; createdAt: string }>;
export type TimelineEvent = Readonly<{ id: string; type: string; action: string; status?: string; occurredAt: string; summary: Readonly<Record<string, unknown>> }>;
export type OrderDetails = Readonly<{ order: OrderSummary; payments: readonly Readonly<Record<string, unknown>>[]; refunds: readonly Readonly<Record<string, unknown>>[]; fulfilments: readonly Readonly<Record<string, unknown>>[]; timeline: readonly TimelineEvent[] }>;
export type RefundReservation = Readonly<{ outcome: "reserved" | "replayed"; refundId: string; paymentId: string; provider: string; providerPaymentId: string; currency: string; amountMinor: number; refundableMinor: number; result?: Readonly<Record<string, unknown>> }>;

export type CaptureCommand = Readonly<{ orderId: string; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>;
export type CaptureResult = Readonly<{ status: "completed" | "failed" | "resolution_required"; providerCaptureId?: string }>;
export type CaptureReservation = Readonly<{ outcome: "reserved"; paymentId: string; provider: string; providerPaymentId: string; amountMinor: number; currency: string }> | Readonly<{ outcome: "replayed"; result: CaptureResult }>;
export interface OperationsRepository {
  reserveCapture(input: CaptureCommand): Promise<CaptureReservation>;
  finishCapture(input: CaptureCommand & { paymentId: string; result: CaptureResult }): Promise<CaptureResult>;
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

export class OperationsService {
  constructor(private readonly repository: OperationsRepository, private readonly providers: PaymentProviderRegistry) {}
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
      const captured = await provider.capture({ ...input, paymentId: reservation.paymentId, providerPaymentId: reservation.providerPaymentId, amount, authorisedAmount: amount, correlationId: command.correlationId });
      const verified = captured.provider === reservation.provider && captured.providerPaymentId === reservation.providerPaymentId &&
        captured.amount.value === amount.value && captured.amount.currency === amount.currency && !!captured.providerCaptureId;
      result = verified
        ? { status: captured.status === "pending" ? "resolution_required" : captured.status, providerCaptureId: captured.providerCaptureId }
        : { status: "resolution_required" };
    } catch (error) {
      // Unknown errors can occur after the provider accepted the request. Never resend automatically.
      result = { status: error instanceof PaymentProviderError && !error.retryable &&
        ["configuration_error", "authentication_error", "validation_error", "payment_declined"].includes(error.category) ? "failed" : "resolution_required" };
    }
    // A persistence failure leaves the durable reservation in place, blocking another provider call.
    return this.repository.finishCapture({ ...command, paymentId: reservation.paymentId, result });
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
