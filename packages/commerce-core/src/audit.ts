import { CommerceDomainError } from "./errors.js";

export type AuditEvent = Readonly<{
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorType: "system" | "customer" | "operator" | "provider";
  actorId?: string;
  occurredAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export const createAuditEvent = (input: Omit<AuditEvent, "occurredAt" | "metadata"> & Readonly<{
  occurredAt?: Date;
  metadata?: Readonly<Record<string, unknown>>;
}>): AuditEvent => {
  if (![input.eventType, input.aggregateType, input.aggregateId].every((value) => value.trim().length > 0)) {
    throw new CommerceDomainError("invalid_audit_event", "Audit events require a type and aggregate identity.");
  }
  const occurredAt = input.occurredAt ?? new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new CommerceDomainError("invalid_audit_event", "Audit event time must be valid.");
  }
  return Object.freeze({ ...input, occurredAt: occurredAt.toISOString(), metadata: Object.freeze({ ...(input.metadata ?? {}) }) });
};
