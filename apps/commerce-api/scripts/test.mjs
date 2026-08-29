import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), "cyph1-commerce-api-"));
const nodeExecutable = process.execPath;
const tscExecutable = join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");

try {
  execFileSync(nodeExecutable, [tscExecutable, "-p", join(packageRoot, "tsconfig.json"), "--rootDir", repositoryRoot, "--noEmit", "false", "--outDir", outputDirectory], { stdio: "inherit" });
  execFileSync(nodeExecutable, ["--test", join(outputDirectory, "apps", "commerce-api", "src", "payments", "payments.test.js")], { stdio: "inherit" });
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
