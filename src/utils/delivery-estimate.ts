/** Indicative shipping preview only. Never use for promises, checkout prices or fulfilment SLAs. */
export type DeliveryMethod = "inpost" | "royal-mail";
const londonDate = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
}).formatToParts(date).reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {} as Record<string, string>);
const londonParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: get("weekday"), minuteOfDay: Number(get("hour")) * 60 + Number(get("minute")) };
};
const dayAtNoon = (date: Date, addDays: number) => {
  const parts = londonDate(date);
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + addDays, 12));
};
const isWeekend = (date: Date) => [0, 6].includes(date.getUTCDay());
const addWorkingDays = (start: Date, days: number) => {
  let date = start;
  let remaining = days;
  while (remaining > 0) {
    date = new Date(date.getTime() + 86_400_000);
    if (!isWeekend(date)) remaining--;
  }
  return date;
};
const formatDate = (date: Date) => new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
}).format(date);
export function calculateDeliveryPreview(now: Date, method: DeliveryMethod, cutoffHour = 14) {
  const local = londonParts(now);
  const dispatchOffset = local.minuteOfDay >= cutoffHour * 60 ? 1 : 0;
  const dispatch = dayAtNoon(now, dispatchOffset);
  // Conservative: first carrier processing day is the next working day after planned drop-off.
  const carrierStart = addWorkingDays(dispatch, 1);
  const earliest = addWorkingDays(carrierStart, method === "inpost" ? 3 : 2);
  const latest = addWorkingDays(carrierStart, method === "inpost" ? 4 : 4);
  // Countdown to next UK-local 14:00 boundary. DST-safe because candidate dates are
  // projected to the correct Europe/London UTC offset using Intl.
  const year = Number(londonDate(now).year), month = Number(londonDate(now).month), day = Number(londonDate(now).day);
  const nextLocalDay = new Date(Date.UTC(year, month - 1, day + dispatchOffset, 12));
  const localISO = `${nextLocalDay.getUTCFullYear()}-${String(nextLocalDay.getUTCMonth()+1).padStart(2,"0")}-${String(nextLocalDay.getUTCDate()).padStart(2,"0")}`;
  const noonUTC = new Date(`${localISO}T12:00:00Z`);
  const hourInLondon = Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",hourCycle:"h23"}).format(noonUTC));
  const offsetHours = hourInLondon - 12;
  const cutoffUTC = new Date(`${localISO}T${String(cutoffHour - offsetHours).padStart(2,"0")}:00:00Z`);
  return {
    window: `${formatDate(earliest)} – ${formatDate(latest)}`,
    minutesUntilCutoff: Math.max(0, Math.ceil((cutoffUTC.getTime() - now.getTime()) / 60_000)),
  };
}
export const formatCountdown = (minutes: number) => {
  const days = Math.floor(minutes / 1440), hours = Math.floor((minutes % 1440) / 60), mins = minutes % 60;
  return [days ? `${days}d` : "", `${hours}h`, `${mins}m`].filter(Boolean).join(" ");
};
