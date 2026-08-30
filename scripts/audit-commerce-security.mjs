import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => !path.endsWith("package-lock.json"));

const findings = [];
const highConfidenceSecrets = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "live Mollie key", pattern: /\blive_[A-Za-z0-9]{20,}\b/ },
  { name: "live Stripe key", pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
];
const publicSecretName = /\bPUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL)[A-Z0-9_]*\b/;

for (const path of tracked) {
  let content;
  try { content = readFileSync(path, "utf8"); } catch { continue; }
  if (publicSecretName.test(content)) findings.push(`${path}: secret-like variable uses the PUBLIC_ namespace`);
  for (const candidate of highConfidenceSecrets) {
    if (candidate.pattern.test(content)) findings.push(`${path}: possible ${candidate.name}`);
  }
}

if (findings.length > 0) {
  console.error("Commerce security audit failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Commerce security audit passed (${tracked.length} tracked files checked).`);
