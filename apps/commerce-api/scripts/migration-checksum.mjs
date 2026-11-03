import { createHash } from "node:crypto";

/**
 * Strict migration integrity by default. On the exact CYPH/1 development
 * database only, versions 0011..0019 can carry the SHA256 of the identical
 * committed SQL file with CRLF line endings. No migration history is modified.
 */
const legacy = new Set([
  "0011_operator_capture.sql",
  "0012_capture_deadline_monitor.sql",
  "0013_capture_command_reconciliation.sql",
  "0014_pending_capture_command.sql",
  "0015_merchandise_returns.sql",
  "0016_manual_dispatch.sql",
  "0017_communication_send_safety.sql",
  "0018_shipping_pricing_evidence.sql",
  "0019_carrier_tariffs_and_packaging.sql",
]);

export const sha256 = content => createHash("sha256").update(content).digest("hex");

export function migrationChecksumMatches({ file, content, recorded, databaseName }) {
  if (typeof recorded !== "string" || !/^[a-f0-9]{64}$/.test(recorded)) return false;
  if (recorded === sha256(content)) return true;
  if (databaseName !== "cyph1_commerce_development" || !legacy.has(file)) return false;
  // GitHub stores LF; earlier development migration runs read CRLF in Windows.
  // Only accept a byte-for-byte CRLF encoding of exactly the current LF text.
  if (content.includes("\r")) return false;
  return recorded === sha256(content.replace(/\n/g, "\r\n"));
}

export const legacyLineEndingVersions = Object.freeze([...legacy]);
