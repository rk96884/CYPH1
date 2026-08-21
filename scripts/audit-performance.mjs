import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const dist = resolve("dist");
const htmlFiles = (await readdir(dist, { recursive: true }))
  .filter((file) => file.endsWith(".html"))
  .map((file) => join(dist, file));
const allFiles = await readdir(dist, { recursive: true });
const javascriptFiles = allFiles.filter((file) => extname(file) === ".js");
const resources = new Set(htmlFiles);

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)["']/g)) {
    const candidate = join(dist, match[1].replace(/^\//, ""));
    try {
      if ((await stat(candidate)).isFile()) resources.add(candidate);
    } catch {
      // Page routes and fragment links are not static payload resources.
    }
  }
}

let rawBytes = 0;
let gzipBytes = 0;
for (const resource of resources) {
  const content = await readFile(resource);
  rawBytes += content.length;
  gzipBytes += gzipSync(content).length;
}

const initialBudget = 200 * 1024;
const format = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

console.log(`Production pages checked: ${htmlFiles.length}`);
console.log(`Unique first-party initial resources: ${resources.size}`);
console.log(`First-party payload: ${format(rawBytes)} raw / ${format(gzipBytes)} gzip`);
console.log(`Generated JavaScript bundles: ${javascriptFiles.length}`);

const failures = [];
if (gzipBytes > initialBudget) failures.push(`compressed first-party payload exceeds ${format(initialBudget)}`);
if (javascriptFiles.length) failures.push(`unexpected generated JavaScript: ${javascriptFiles.join(", ")}`);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  process.exit(1);
}

console.log("Performance budget audit passed.");

