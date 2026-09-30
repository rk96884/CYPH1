import { createHash } from "node:crypto";
import type { CaptureReplayEvidence } from "../../../../packages/commerce-core/src/index.js";

// https://docs.mollie.com/reference/api-idempotency (reviewed 2026-09-29):
// cache lasts one hour and is credential-bound. Keep five minutes of headroom.
// Include the wire format version: changing POST parameters invalidates safe replay.
export const mollieCaptureContext = (credential: string, apiBaseUrl = "https://api.mollie.com/v2"): string =>
  createHash("sha256").update(JSON.stringify(["mollie-capture-v1", apiBaseUrl, credential])).digest("hex");

export const mollieCaptureReplaySafe = (evidence: CaptureReplayEvidence, context: string, now: Date): boolean => {
  const started = Date.parse(evidence.firstAttemptAt);
  const elapsed = now.getTime() - started;
  return evidence.providerContext === context && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 55 * 60 * 1000;
};
