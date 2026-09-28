import type { CaptureMode } from "../../../../packages/commerce-core/src/index.js";

export type CaptureDeadlineState = "safe" | "warning" | "critical" | "overdue" | "missing_deadline" | "reconciliation_required";
export type CaptureDeadlineConfig = Readonly<{ warningMinutes: number; criticalMinutes: number; maxPayments: number }>;

export const loadCaptureDeadlineConfig = (environment: Readonly<Record<string, string | undefined>>): CaptureDeadlineConfig => {
  const integer = (key: string, fallback: number, maximum: number): number => {
    const raw = environment[key] ?? String(fallback);
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > maximum) throw new Error(`${key} must be a positive integer no greater than ${maximum}.`);
    return Number(raw);
  };
  const warningMinutes = integer("CAPTURE_DEADLINE_WARNING_MINUTES", 1440, 525600);
  const criticalMinutes = integer("CAPTURE_DEADLINE_CRITICAL_MINUTES", 360, 525600);
  if (criticalMinutes >= warningMinutes) throw new Error("CAPTURE_DEADLINE_CRITICAL_MINUTES must be less than CAPTURE_DEADLINE_WARNING_MINUTES.");
  return { warningMinutes, criticalMinutes, maxPayments: integer("CAPTURE_DEADLINE_MAX_PAYMENTS", 100, 10000) };
};

/** Require an unambiguous provider timestamp, with an explicit UTC offset. Nullable provider fields are treated as absent. */
export const providerTimestamp = (value: string | null | undefined): string | undefined => {
  if (value == null) return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("invalid_provider_timestamp");
  const daysInMonth = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate();
  if (Number(value.slice(8, 10)) > daysInMonth) throw new Error("invalid_provider_timestamp");
  return new Date(value).toISOString();
};

export const captureDeadlineState = (mode: CaptureMode | null, deadline: string | null, now: Date, config: CaptureDeadlineConfig): CaptureDeadlineState => {
  if (!Number.isFinite(now.getTime())) throw new Error("invalid_monitor_time");
  if (mode !== "manual") return "reconciliation_required";
  if (!deadline) return "missing_deadline";
  const remaining = Date.parse(providerTimestamp(deadline)!) - now.getTime();
  if (remaining <= 0) return "overdue";
  if (remaining <= config.criticalMinutes * 60000) return "critical";
  if (remaining <= config.warningMinutes * 60000) return "warning";
  return "safe";
};
