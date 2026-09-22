import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import process from "node:process";

export const validateBackupBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error("Backup is missing or too small to be a valid PostgreSQL custom-format dump.");
  if (buffer.subarray(0,5).toString("ascii") !== "PGDMP") throw new Error("Backup is not a PostgreSQL custom-format dump.");
  return Object.freeze({ sizeBytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") });
};

export const validateEncryptedBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) throw new Error("Encrypted backup is missing or unexpectedly small.");
  if (buffer.subarray(0,8).toString("ascii") !== "Salted__") throw new Error("Encrypted backup does not have the expected OpenSSL salted envelope.");
  return Object.freeze({ sizeBytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") });
};

if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll("\\","/")}`).href) {
  const [dumpPath, encryptedPath] = process.argv.slice(2);
  if (!dumpPath || !encryptedPath) throw new Error("Usage: node validate-backup-artifacts.mjs <dump> <encrypted>");
  const dump = await readFile(dumpPath);
  const encrypted = await readFile(encryptedPath);
  const dumpEvidence=validateBackupBuffer(dump), encryptedEvidence=validateEncryptedBuffer(encrypted);
  const encryptedStat=await stat(encryptedPath);
  console.log(`Validated PostgreSQL custom-format backup: ${dumpEvidence.sizeBytes} bytes; SHA-256 ${dumpEvidence.sha256}`);
  console.log(`Validated encrypted backup envelope: ${encryptedEvidence.sizeBytes} bytes; SHA-256 ${encryptedEvidence.sha256}`);
  console.log(`Encrypted artifact modified UTC: ${encryptedStat.mtime.toISOString()}`);
}
