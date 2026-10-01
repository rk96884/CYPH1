/** Merchandise workflow only. Reported categories are not findings or entitlements. */
export const returnCategories = ["customer_choice", "damaged_reported", "fault_reported", "incorrect_item", "delivery_issue", "other"] as const;
export type ReturnCategory = typeof returnCategories[number];
export type ReturnStatus = "requested" | "approved" | "received" | "closed" | "rejected" | "cancelled";
export const returnInspectionOutcomes = ["no_issue_observed", "issue_observed", "inconclusive", "not_applicable"] as const;
export type ReturnInspectionOutcome = typeof returnInspectionOutcomes[number];
export const returnDecisionReasons = ["operator_approved", "not_approved", "duplicate_request", "request_withdrawn"] as const;
export type ReturnDecisionReason = typeof returnDecisionReasons[number];
export type ReturnClosureReason = "no_refund_due" | "refund_completed";
export type ReturnAction = "approve" | "reject" | "cancel" | "receive" | "inspect" | "close";
export class ReturnDomainError extends Error {
  constructor(readonly code: "invalid_request" | "conflict" | "not_found", message: string) { super(message); this.name = "ReturnDomainError"; }
}
export const transitionReturn = (current: ReturnStatus, action: ReturnAction, receiptWaived = false): ReturnStatus => {
  if (action === "approve" && current === "requested") return "approved";
  if (action === "reject" && current === "requested") return "rejected";
  if (action === "cancel" && current === "requested") return "cancelled";
  if (action === "receive" && ["approved", "received"].includes(current) && !receiptWaived) return "received";
  if (action === "inspect" && current === "received") return "received";
  if (action === "close" && (current === "received" || (current === "approved" && receiptWaived))) return "closed";
  throw new ReturnDomainError("conflict", "The return action is not valid in its current state.");
};
export const returnQuantity = (value: unknown, allowZero = false): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 2_147_483_647) {
    throw new ReturnDomainError("invalid_request", "A valid integer quantity is required.");
  }
  return value;
};
export const assertReturnClosure = (input: Readonly<{
  approvedRefundMinor: number | null; inspected: boolean; receiptWaived: boolean;
  refunds: readonly Readonly<{ status: string; amountMinor: number; currency: string }>[]; currency: string;
}>): ReturnClosureReason => {
  if (input.approvedRefundMinor === null || (!input.receiptWaived && !input.inspected)) {
    throw new ReturnDomainError("conflict", "An explicit monetary decision and separate inspection are required before closure.");
  }
  if (input.refunds.some((refund) => refund.currency !== input.currency || !["completed", "failed", "cancelled"].includes(refund.status))) {
    throw new ReturnDomainError("conflict", "The linked refund outcome must be resolved before closure.");
  }
  const completed = input.refunds.filter((refund) => refund.status === "completed").reduce((total, refund) => total + refund.amountMinor, 0);
  if (!Number.isSafeInteger(completed) || completed !== input.approvedRefundMinor) {
    throw new ReturnDomainError("conflict", "The approved financial obligation is not satisfied.");
  }
  return completed === 0 ? "no_refund_due" : "refund_completed";
};
