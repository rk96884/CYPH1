import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const allowedBuildPackages = new Set([
  "@astrojs/check",
  "@astrojs/language-server",
  "ajv",
  "ajv-draft-04",
  "ajv-i18n",
  "fast-uri",
  "volar-service-yaml",
  "yaml-language-server",
]);
const allowedAdvisories = new Set([
  "https://github.com/advisories/GHSA-5jgf-p345-68v8",
  "https://github.com/advisories/GHSA-f65p-4m7j-42xc",
  "https://github.com/advisories/GHSA-fph4-wmhf-6fwf",
  "https://github.com/advisories/GHSA-jqff-g426-hqxp",
]);
const exceptionExpiresAt = Date.parse("2026-10-08T00:00:00Z");

export const evaluateDependencyAudits = ({ production, complete, now = Date.now() }) => {
  const productionTotal = production.metadata?.vulnerabilities?.total ?? 0;
  if (productionTotal !== 0) throw new Error("Production dependency audit contains vulnerabilities.");

  const vulnerabilities = complete.vulnerabilities ?? {};
  if (Object.keys(vulnerabilities).length === 0) return Object.freeze({ exception: false, advisories: 0 });
  if (now >= exceptionExpiresAt) throw new Error("The Astro build-tool vulnerability exception has expired.");

  const unexpectedPackages = Object.keys(vulnerabilities).filter((name) => !allowedBuildPackages.has(name));
  if (unexpectedPackages.length > 0) {
    throw new Error(`Dependency audit contains unapproved vulnerable packages: ${unexpectedPackages.join(", ")}.`);
  }
  const reportedAdvisories = new Set();
  for (const vulnerability of Object.values(vulnerabilities)) {
    if (vulnerability.severity !== "high") throw new Error("Dependency audit contains an unapproved severity.");
    for (const cause of vulnerability.via ?? []) {
      if (typeof cause === "object" && cause.url) reportedAdvisories.add(cause.url);
    }
  }
  const unexpectedAdvisories = [...reportedAdvisories].filter((url) => !allowedAdvisories.has(url));
  if (unexpectedAdvisories.length > 0 || reportedAdvisories.size !== allowedAdvisories.size) {
    throw new Error("Dependency audit does not match the approved build-tool advisory set.");
  }
  return Object.freeze({ exception: true, advisories: reportedAdvisories.size });
};

const runAudit = (arguments_) => {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
  const commandArguments = npmCli
    ? [npmCli, "audit", "--json", ...arguments_]
    : ["audit", "--json", ...arguments_];
  const result = spawnSync(command, commandArguments, { encoding: "utf8", windowsHide: true });
  if (!result.stdout?.trim()) throw new Error(result.error?.message || result.stderr?.trim() || "npm audit returned no report.");
  try { return JSON.parse(result.stdout); }
  catch { throw new Error("npm audit returned malformed JSON."); }
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    const result = evaluateDependencyAudits({
      production: runAudit(["--omit=dev", "--audit-level=moderate"]),
      complete: runAudit(["--audit-level=high"]),
    });
    if (result.exception) {
      console.warn(`Production dependency audit passed. Accepted ${result.advisories} Astro build-tool advisories until 8 October 2026.`);
    } else {
      console.log("Production and complete dependency audits passed with no vulnerabilities.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Dependency audit failed.");
    process.exitCode = 1;
  }
}
