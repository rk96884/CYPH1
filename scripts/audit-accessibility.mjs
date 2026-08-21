import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pages = [
  ["Home", "dist/index.html"],
  ["Privacy", "dist/privacy/index.html"],
  ["Accessibility", "dist/accessibility/index.html"],
  ["Confirmation", "dist/early-access/confirmed/index.html"],
];

const failures = [];
const pass = (page, check) => console.log(`PASS  ${page}: ${check}`);
const assert = (condition, page, check) => {
  if (condition) pass(page, check);
  else failures.push(`${page}: ${check}`);
};

const matches = (source, expression) => [...source.matchAll(expression)];

for (const [name, file] of pages) {
  const html = await readFile(resolve(file), "utf8");
  const ids = matches(html, /\sid=["']([^"']+)["']/gi).map((match) => match[1]);
  const headings = matches(html, /<h([1-6])\b[^>]*>/gi).map((match) => Number(match[1]));
  const images = matches(html, /<img\b[^>]*>/gi).map((match) => match[0]);
  const fragments = matches(html, /href=["']#([^"']+)["']/gi).map((match) => match[1]);
  const skippedHeading = headings.some((level, index) => index > 0 && level > headings[index - 1] + 1);

  assert(/<html\b[^>]*\blang=["']en-GB["']/i.test(html), name, "document language is en-GB");
  assert(matches(html, /<main\b[^>]*\bid=["']main["'][^>]*>/gi).length === 1, name, "has one main landmark");
  assert(matches(html, /<h1\b[^>]*>/gi).length === 1, name, "has exactly one h1");
  assert(/<meta\b[^>]*name=["']viewport["']/i.test(html), name, "has a viewport meta tag");
  assert(!/tabindex=["'][1-9]\d*["']/i.test(html), name, "has no positive tabindex values");
  assert(images.every((image) => /\salt=(?:["'][^"']*["']|[^\s>]+)/i.test(image)), name, "all images define alt text");
  assert(new Set(ids).size === ids.length, name, "has no duplicate IDs");
  assert(!skippedHeading, name, "heading levels do not skip");
  assert(fragments.every((fragment) => ids.includes(fragment)), name, "same-page fragment links resolve");

  if (name === "Home") {
    assert(/<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main["']/i.test(html), name, "skip link targets main content");
    assert(/<label\b[^>]*for=["']email["']/i.test(html) && /<input\b[^>]*id=["']email["']/i.test(html), name, "email input has an associated label");
    assert(/role=["']status["']/i.test(html) && /aria-live=["']polite["']/i.test(html), name, "form status is announced politely");
    assert(/<label\b[^>]*class=["'][^"']*consent-control[^"']*["'][^>]*>[\s\S]*?<input\b[^>]*type=["']checkbox["']/i.test(html), name, "consent checkbox is labelled");
    assert(matches(html, /<button\b[^>]*>[\s\S]*?<\/button>/gi).every((match) => match[0].replace(/<[^>]+>/g, "").trim()), name, "buttons have accessible text");
  }
}

const css = await readFile(resolve("src/styles/global.css"), "utf8");
assert(css.includes(":focus-visible"), "Global CSS", "defines a visible keyboard focus style");
assert(css.includes("prefers-reduced-motion:reduce"), "Global CSS", "honours reduced-motion preferences");

if (failures.length) {
  console.error(`\nAccessibility audit failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("\nAccessibility audit passed with no structural failures.");

