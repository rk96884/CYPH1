import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const dist = resolve("dist");
const htmlFiles = (await readdir(dist, { recursive: true }))
  .filter((file) => file.endsWith(".html"))
  .map((file) => resolve(dist, file));
const failures = [];
let checkedInternalLinks = 0;
let checkedContactLinks = 0;

const exists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  const page = relative(dist, htmlFile);

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (!href || href.includes("{{") || href.startsWith("#") || href.startsWith("https://") || href.startsWith("http://")) continue;

    if (href.startsWith("mailto:")) {
      checkedContactLinks += 1;
      if (!/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) failures.push(`${page}: malformed email link ${href}`);
      continue;
    }

    if (/^[a-z][a-z\d+.-]*:/i.test(href)) continue;
    checkedInternalLinks += 1;
    const pathname = href.split(/[?#]/, 1)[0];
    const target = pathname.startsWith("/") ? resolve(dist, `.${pathname}`) : resolve(dirname(htmlFile), pathname);
    const candidates = pathname.endsWith("/") ? [join(target, "index.html")] : [target, `${target}.html`, join(target, "index.html")];
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) failures.push(`${page}: unresolved internal link ${href}`);
  }
}

if (failures.length) {
  console.error(`Link audit failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`HTML pages checked: ${htmlFiles.length}`);
console.log(`Internal links checked: ${checkedInternalLinks}`);
console.log(`Email contact links checked: ${checkedContactLinks}`);
console.log("Production link audit passed.");
