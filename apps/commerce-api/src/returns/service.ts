import { createHash, randomUUID } from "node:crypto";
import { ReturnDomainError, returnCategories, returnInspectionOutcomes, returnQuantity,
  type ReturnAction, type ReturnCategory, type ReturnInspectionOutcome, type ReturnStatus } from "../../../../packages/commerce-core/src/index.js";

export type ReturnItem = Readonly<{ orderItemId: string; requestedQuantity: number; approvedQuantity: number | null; receivedQuantity: number }>;
export type ReturnRecord = Readonly<{
  id: string; reference: string; orderId: string; status: ReturnStatus; category: ReturnCategory; currency: string;
  approvedRefundMinor: number | null; receiptRequired: boolean; receiptWaiverReason: string | null;
  inspectionOutcome: ReturnInspectionOutcome | null; decisionReason: string | null; closureReason: string | null;
  requestedAt: string; approvedAt: string | null; receivedAt: string | null; inspectedAt: string | null; closedAt: string | null;
  createdAt: string; updatedAt: string; version: number; items: readonly ReturnItem[];
}>;
type Quantities = readonly Readonly<{ orderItemId: string; quantity: number }>[];
export type ReturnOperation =
  | Readonly<{ action: "request"; orderId: string; category: ReturnCategory; items: Quantities }>
  | (Readonly<{ action: ReturnAction; orderId: string; returnId: string; expectedVersion: number }> & (
    | Readonly<{ action: "approve"; approvedRefundMinor: number; receiptRequired: boolean; receiptWaiverReason: "receipt_not_required" | "operator_waiver" | null; items: Quantities }>
    | Readonly<{ action: "reject"; reason: "not_approved" | "duplicate_request" }>
    | Readonly<{ action: "cancel"; reason: "request_withdrawn" | "duplicate_request" }>
    | Readonly<{ action: "receive"; items: Quantities }>
    | Readonly<{ action: "inspect"; outcome: ReturnInspectionOutcome }>
    | Readonly<{ action: "close" }>
  ));
export type ReturnCommand = ReturnOperation & Readonly<{ operatorId: string; idempotencyKey: string; fingerprint: string; correlationId: string }>;
export interface ReturnRepository {
  execute(command: ReturnCommand): Promise<ReturnRecord>;
  list(orderId: string): Promise<readonly ReturnRecord[]>;
}
export const returnUuid = (value: unknown): string => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ReturnDomainError("invalid_request", "A valid identifier is required.");
  return value.toLowerCase();
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReturnDomainError("invalid_request", "A structured return request is required.");
  return value as Record<string, unknown>;
};
const keys = (body: Record<string, unknown>, allowed: readonly string[]): void => {
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new ReturnDomainError("invalid_request", "Unexpected return fields.");
};
const controlled = <T extends string>(value: unknown, values: readonly T[]): T => {
  const found = values.find((allowed) => allowed === value);
  if (!found) throw new ReturnDomainError("invalid_request", "A controlled return value is required.");
  return found;
};
const quantities = (value: unknown, allowZero = false): Quantities => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new ReturnDomainError("invalid_request", "Select between one and 100 return items.");
  const result = value.map((entry: unknown) => { const item = object(entry); keys(item, ["orderItemId", "quantity"]); return { orderItemId: returnUuid(item.orderItemId), quantity: returnQuantity(item.quantity, allowZero) }; }).sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));
  if (new Set(result.map((item) => item.orderItemId)).size !== result.length || !result.some((item) => item.quantity > 0)) throw new ReturnDomainError("invalid_request", "Select distinct items with a positive total quantity.");
  return result;
};

export class ReturnService {
  constructor(private readonly repository: ReturnRepository) {}
  list(orderId: string) { return this.repository.list(returnUuid(orderId)); }
  async request(orderId: string, input: unknown, operatorId: string, idempotencyKey: string) {
    const body = object(input); keys(body, ["category", "items"]);
    return this.execute({ action: "request", orderId: returnUuid(orderId), category: controlled(body.category, returnCategories), items: quantities(body.items) }, operatorId, idempotencyKey);
  }
  async act(orderId: string, returnId: string, action: ReturnAction, input: unknown, operatorId: string, idempotencyKey: string) {
    const body = object(input);
    const expectedVersion = returnQuantity(body.expectedVersion);
    const base = { orderId: returnUuid(orderId), returnId: returnUuid(returnId), expectedVersion };
    let operation: ReturnOperation;
    switch (action) {
      case "approve": {
        keys(body, ["expectedVersion", "approvedRefundMinor", "receiptRequired", "receiptWaiverReason", "items"]);
        if (typeof body.approvedRefundMinor !== "number" || !Number.isSafeInteger(body.approvedRefundMinor) || body.approvedRefundMinor < 0 || typeof body.receiptRequired !== "boolean") throw new ReturnDomainError("invalid_request", "Approval requires an explicit non-negative monetary decision and receipt requirement.");
        const waiver = body.receiptRequired ? null : controlled(body.receiptWaiverReason, ["receipt_not_required", "operator_waiver"] as const);
        if (body.receiptRequired && body.receiptWaiverReason != null) throw new ReturnDomainError("invalid_request", "A required receipt cannot be waived.");
        operation = { ...base, action, approvedRefundMinor: body.approvedRefundMinor, receiptRequired: body.receiptRequired, receiptWaiverReason: waiver, items: quantities(body.items, true) }; break;
      }
      case "reject": keys(body, ["expectedVersion", "reason"]); operation = { ...base, action, reason: controlled(body.reason, ["not_approved", "duplicate_request"] as const) }; break;
      case "cancel": keys(body, ["expectedVersion", "reason"]); operation = { ...base, action, reason: controlled(body.reason, ["request_withdrawn", "duplicate_request"] as const) }; break;
      case "receive": keys(body, ["expectedVersion", "items"]); operation = { ...base, action, items: quantities(body.items, true) }; break;
      case "inspect": keys(body, ["expectedVersion", "outcome"]); operation = { ...base, action, outcome: controlled(body.outcome, returnInspectionOutcomes) }; break;
      case "close": keys(body, ["expectedVersion"]); operation = { ...base, action }; break;
      default: throw new ReturnDomainError("invalid_request", "Unknown return action.");
    }
    return this.execute(operation, operatorId, idempotencyKey);
  }
  private execute(operation: ReturnOperation, operatorId: string, idempotencyKey: string) {
    if (!operatorId.trim() || operatorId.length > 254 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)) throw new ReturnDomainError("invalid_request", "A valid operator and idempotency key are required.");
    const fingerprint = createHash("sha256").update(JSON.stringify({ ...operation, operatorId })).digest("hex");
    return this.repository.execute({ ...operation, operatorId, idempotencyKey, fingerprint, correlationId: randomUUID() });
  }
}
