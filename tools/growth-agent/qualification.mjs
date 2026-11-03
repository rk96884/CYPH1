/**
 * CYPH/1 Growth Agent — deterministic, research-only prospect qualification.
 * No network requests, outbound messaging, customer data, or AI calls.
 * Source evidence is mandatory; unknown data is never invented.
 */
export const CHANNELS = Object.freeze(["creator", "partner"]);
export const WEIGHTS = Object.freeze({
  creator: { relevance: 30, ukAudience: 25, engagement: 20, brandFit: 15, feasibility: 10 },
  partner: { relevance: 30, ukAudience: 25, engagement: 10, brandFit: 20, feasibility: 15 },
});

function validUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}
function limitedText(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
/**
 * Input: {name, channel, sourceUrl, sourceCheckedAt, evidence: {
 *   relevance: {rating:0..5, sourceUrl, note}, ... }}
 * A dimension without verifiable evidence scores zero and reduces confidence.
 */
export function qualifyProspect(input) {
  if (!input || typeof input !== "object") throw new TypeError("Prospect required");
  const { channel } = input;
  if (!CHANNELS.includes(channel)) throw new RangeError("Unsupported prospect channel");
  if (!validUrl(input.sourceUrl)) throw new TypeError("Valid public sourceUrl required");
  const name = limitedText(input.name, 160);
  if (!name) throw new TypeError("Prospect name required");
  const timestamp = Date.parse(input.sourceCheckedAt);
  if (!Number.isFinite(timestamp)) throw new TypeError("Valid sourceCheckedAt required");
  const weights = WEIGHTS[channel];
  let score = 0, verifiedDimensions = 0;
  const breakdown = {};
  for (const [dimension, weight] of Object.entries(weights)) {
    const item = input.evidence?.[dimension];
    const rating = item?.rating;
    const verified = Number.isInteger(rating) && rating >= 0 && rating <= 5 &&
      validUrl(item?.sourceUrl) && Boolean(limitedText(item?.note));
    const points = verified ? Math.round(weight * rating / 5) : 0;
    score += points;
    if (verified) verifiedDimensions++;
    breakdown[dimension] = { points, maximum: weight, verified, note: verified ? limitedText(item.note) : "" };
  }
  return {
    name, channel, sourceUrl: input.sourceUrl, sourceCheckedAt: new Date(timestamp).toISOString(),
    score, confidence: verifiedDimensions / Object.keys(weights).length,
    status: "research_only", outreachAllowed: false,
    reviewRequired: true, breakdown
  };
}
export function rankProspects(prospects) {
  return prospects.map(qualifyProspect).sort((a, b) =>
    b.score - a.score || b.confidence - a.confidence || a.name.localeCompare(b.name)
  );
}
