import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pages = [
  ["Private checkout", "dist/private-commerce/integration-test-fixture/index.html"],
  ["Pending status", "dist/private-commerce/status/pending/index.html"],
  ["Success status", "dist/private-commerce/status/success/index.html"],
  ["Cancelled status", "dist/private-commerce/status/cancelled/index.html"],
  ["Error status", "dist/private-commerce/status/error/index.html"],
  ["Private operations", "dist/private-operations/operations-test/index.html"],
];

const failures = [];
const assert = (condition, page, check) => {
  if (condition) console.log(`PASS  ${page}: ${check}`);
  else failures.push(`${page}: ${check}`);
};
const matches = (source, expression) => [...source.matchAll(expression)];

for (const [name, file] of pages) {
  const html = await readFile(resolve(file), "utf8");
  const ids = matches(html, /\sid=["']([^"']+)["']/gi).map((match) => match[1]);
  const inputs = matches(html, /<(?:input|select)\b[^>]*>/gi).map((match) => match[0]);

  assert(/<html\b[^>]*\blang=["']en-GB["']/i.test(html), name, "document language is en-GB");
  assert(matches(html, /<main\b[^>]*\bid=["']main["'][^>]*>/gi).length === 1, name, "has one main landmark");
  assert(matches(html, /<h1\b[^>]*>/gi).length === 1, name, "has exactly one h1");
  assert(/<meta\b[^>]*name=["']viewport["']/i.test(html), name, "has a viewport meta tag");
  assert(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html), name, "is excluded from indexing");
  assert(!/tabindex=["'][1-9]\d*["']/i.test(html), name, "has no positive tabindex values");
  assert(new Set(ids).size === ids.length, name, "has no duplicate IDs");
  assert(inputs.every((control) => !/\brequired\b/i.test(control) || /(?:<label\b[^>]*>[^<]*$|id=["'][^"']+["'])/i.test(html.slice(0, html.indexOf(control) + control.length))), name, "required controls have label context or an ID");

  if (name === "Private checkout") {
    assert(/<form\b[^>]*aria-describedby=["']private-checkout-warning["']/i.test(html), name, "test warning describes the checkout form");
    assert(/data-checkout-status[^>]*role=["']status["'][^>]*aria-live=["']polite["']/i.test(html), name, "checkout status is announced politely");
    assert(/name=["']quantity["'][^>]*type=["']number["'][^>]*min=["']1["']/i.test(html), name, "quantity has a positive numeric constraint");
  }

  if (name === "Private operations") {
    assert(/id=["']message["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i.test(html), name, "operations status is announced politely");
    assert(/id=["']query["'][^>]*required/i.test(html), name, "order search is required");
    const amount = inputs.find((control) => /\bid=["']amount["']/i.test(control)) ?? "";
    assert(/<label\b[^>]*for=["']amount["'][^>]*>Refund amount \(GBP\)<\/label>/i.test(html), name, "refund amount has an associated GBP currency label");
    assert(/\btype=["']text["']/i.test(amount) && /\binputmode=["']decimal["']/i.test(amount), name, "refund amount supports decimal currency entry");
    assert(/\brequired(?:\s|=|\/?>)/i.test(amount), name, "refund amount remains required");
    const descriptions = amount.match(/\baria-describedby=["']([^"']+)["']/i)?.[1].split(/\s+/) ?? [];
    assert(descriptions.includes("refund-amount-error") && descriptions.includes("refund-message") && descriptions.every((id) => ids.includes(id)), name, "refund amount is associated with its validation error and status");
    assert(/<p\b[^>]*id=["']refund-amount-error["'][^>]*role=["']alert["']/i.test(html), name, "refund amount validation errors are announced");
    assert(/<h2\b[^>]*id=["']details-title["'][^>]*tabindex=["']-1["']/i.test(html), name, "order details heading is programmatically focusable");
    assert(/id=["']returns["'][^>]*aria-labelledby=["']returns-title["']/i.test(html), name, "returns section has a heading association");
    assert(/id=["']returns-message["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i.test(html), name, "return outcomes are announced politely");
    assert(/id=["']return-error["'][^>]*role=["']alert["']/i.test(html), name, "return validation failures are announced");
    assert(/id=["']return-quantities["'][^>]*>\s*<legend\b[^>]*>/i.test(html), name, "approved quantities are grouped by a legend");
  }
}

const checkoutSource = await readFile(resolve("src/pages/private-commerce/[slug].astro"), "utf8");
const operationsSource = await readFile(resolve("src/pages/private-operations/[slug].astro"), "utf8");
assert(checkoutSource.includes("@media(max-width:420px)"), "Private checkout CSS", "has a narrow mobile layout");
assert(operationsSource.includes("@media(max-width:520px)"), "Private operations CSS", "has a narrow mobile layout");
assert(checkoutSource.includes("font-size:1rem"), "Private checkout CSS", "avoids mobile input zoom");
assert(operationsSource.includes("font-size:1rem"), "Private operations CSS", "avoids mobile input zoom");
assert(checkoutSource.includes("status.focus()"), "Private checkout behaviour", "moves focus to a failed checkout status");
assert(operationsSource.includes("details?.removeAttribute('hidden')") && operationsSource.includes("(details?.querySelector('#details-title'))?.focus()"), "Private operations behaviour", "reveals order details and moves focus to their heading");

if (failures.length) {
  console.error(`\nPrivate commerce accessibility audit failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("\nPrivate commerce accessibility audit passed with no structural failures.");
