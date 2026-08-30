import { createHash, randomUUID } from "node:crypto";
import { money, PaymentProviderError, type PaymentProviderRegistry } from "../../../../packages/commerce-core/src/index.js";

export const operationPermissions = ["orders:read", "refunds:create", "fulfilment:retry", "reconciliation:export"] as const;
export type OperationPermission = typeof operationPermissions[number];
export type OperationsPrincipal = Readonly<{ id: string; permissions: readonly OperationPermission[] }>;
export type RefundReason = "customer_request" | "cancelled_order" | "returned_goods" | "operator_correction";

export type OrderSummary = Readonly<{ id: string; orderNumber: string; status: string; fulfilmentStatus: string; currency: string; totalMinor: number; createdAt: string }>;
export type TimelineEvent = Readonly<{ id: string; type: string; action: string; status?: string; occurredAt: string; summary: Readonly<Record<string, unknown>> }>;
export type OrderDetails = Readonly<{ order: OrderSummary; payments: readonly Readonly<Record<string, unknown>>[]; refunds: readonly Readonly<Record<string, unknown>>[]; fulfilments: readonly Readonly<Record<string, unknown>>[]; timeline: readonly TimelineEvent[] }>;
export type RefundReservation = Readonly<{ outcome: "reserved" | "replayed"; refundId: string; paymentId: string; provider: string; providerPaymentId: string; currency: string; amountMinor: number; refundableMinor: number; result?: Readonly<Record<string, unknown>> }>;

export interface OperationsRepository {
  searchOrders(query: string, limit: number): Promise<readonly OrderSummary[]>;
  getOrder(orderId: string): Promise<OrderDetails | undefined>;
  reserveRefund(input: Readonly<{ orderId: string; amountMinor: number; reason: RefundReason; operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>): Promise<RefundReservation>;
  completeRefund(input: Readonly<{ refundId: string; providerRefundId: string; status: "pending" | "completed" | "failed"; operatorId: string; correlationId: string }>): Promise<void>;
  failRefund(input: Readonly<{ refundId: string; failureCode: string; operatorId: string; correlationId: string }>): Promise<void>;
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
      await this.repository.failRefund({ refundId: reservation.refundId, failureCode: error instanceof PaymentProviderError ? error.category : "provider_error", operatorId: input.operatorId, correlationId });
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
