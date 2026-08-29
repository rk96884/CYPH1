import type { Money } from "./money.js";
import type { PaymentStatus } from "./state-machine.js";

export type PaymentErrorCategory =
  | "configuration_error" | "authentication_error" | "validation_error"
  | "payment_declined" | "rate_limited" | "provider_unavailable"
  | "network_error" | "conflict" | "not_found" | "unknown_provider_error";

export class PaymentProviderError extends Error {
  constructor(
    readonly category: PaymentErrorCategory,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export type CheckoutLine = Readonly<{
  description: string;
  quantity: number;
  unitPrice: Money;
  totalAmount: Money;
}>;

export type CreateCheckoutInput = Readonly<{
  orderId: string;
  orderNumber: string;
  amount: Money;
  lines: readonly CheckoutLine[];
  customer?: Readonly<{ email?: string; givenName?: string; familyName?: string }>;
  successUrl: string;
  cancellationUrl: string;
  webhookUrl: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type CheckoutSession = Readonly<{
  provider: string;
  providerPaymentId: string;
  checkoutUrl: string;
  status: PaymentStatus;
  expiresAt?: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type GetPaymentInput = Readonly<{ providerPaymentId: string; correlationId: string }>;

export type NormalisedPayment = Readonly<{
  provider: string;
  providerPaymentId: string;
  orderId?: string;
  status: PaymentStatus;
  amount: Money;
  refundableAmount: Money;
  createdAt: string;
  authorisedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  failureCategory?: "declined" | "technical" | "unknown";
}>;

export type RefundInput = Readonly<{
  paymentId: string;
  orderId: string;
  providerPaymentId: string;
  amount: Money;
  refundableAmount: Money;
  reason: "customer_request" | "cancelled_order" | "returned_goods" | "operator_correction";
  operatorId: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type NormalisedRefund = Readonly<{
  provider: string;
  providerPaymentId: string;
  providerRefundId: string;
  amount: Money;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}>;

export type VerifyWebhookInput = Readonly<{
  rawBody: Uint8Array;
  headers: Readonly<Record<string, string>>;
  endpointUrl: string;
}>;

export type VerifiedWebhook = Readonly<{
  outcome: "actionable" | "irrelevant" | "invalid" | "malformed";
  provider: string;
  payload?: unknown;
}>;

export type PaymentEvent = Readonly<{
  eventId: string;
  provider: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  type: "payment.pending" | "payment.authorised" | "payment.paid" | "payment.failed" |
    "payment.cancelled" | "payment.expired" | "refund.pending" | "refund.completed" |
    "refund.failed" | "dispute.opened" | "dispute.updated";
  occurredAt: string;
  amount?: Money;
}>;

export interface PaymentProvider {
  readonly key: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getPayment(input: GetPaymentInput): Promise<NormalisedPayment>;
  refund(input: RefundInput): Promise<NormalisedRefund>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhook>;
  normaliseWebhook(input: VerifiedWebhook): Promise<readonly PaymentEvent[]>;
}

export interface PaymentProviderRegistry {
  getConfiguredProvider(): PaymentProvider;
  getProvider(providerKey: string): PaymentProvider;
}
