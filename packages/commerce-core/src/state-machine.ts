import { CommerceDomainError } from "./errors.js";

export type OrderStatus = "draft" | "pending_payment" | "paid" | "cancelled" | "partially_refunded" | "refunded";
export type PaymentStatus = "created" | "pending" | "authorised" | "captured" | "resolution_required" | "failed" | "cancelled" | "expired" | "partially_refunded" | "refunded" | "dispute_opened" | "dispute_resolved";

const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["partially_refunded", "refunded"],
  cancelled: [],
  partially_refunded: ["refunded"],
  refunded: [],
};

export const transitionOrder = (current: OrderStatus, next: OrderStatus): OrderStatus => {
  if (current === next) return current;
  if (!orderTransitions[current].includes(next)) {
    throw new CommerceDomainError("invalid_order_transition", `Order cannot transition from ${current} to ${next}.`);
  }
  return next;
};

const paymentTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ["pending", "authorised", "captured", "resolution_required", "failed", "cancelled", "expired"],
  pending: ["authorised", "captured", "resolution_required", "failed", "cancelled", "expired"],
  authorised: ["captured", "resolution_required", "failed", "cancelled", "expired"],
  resolution_required: ["pending", "authorised", "captured", "failed", "cancelled", "expired"],
  failed: [], cancelled: [], expired: [],
  captured: ["partially_refunded", "refunded", "dispute_opened"],
  partially_refunded: ["refunded", "dispute_opened"],
  refunded: ["dispute_opened"],
  dispute_opened: ["dispute_resolved"],
  dispute_resolved: [],
};

export type PaymentTransition = Readonly<{ status: PaymentStatus; outcome: "applied" | "ignored" | "requires_review" }>;

export const transitionPayment = (current: PaymentStatus, next: PaymentStatus): PaymentTransition => {
  if (current === next) return Object.freeze({ status: current, outcome: "ignored" });
  if (paymentTransitions[current].includes(next)) return Object.freeze({ status: next, outcome: "applied" });
  if (paymentTransitions[next].includes(current) || ["failed", "cancelled", "expired", "dispute_resolved"].includes(current)) {
    return Object.freeze({ status: current, outcome: "ignored" });
  }
  return Object.freeze({ status: current, outcome: "requires_review" });
};
