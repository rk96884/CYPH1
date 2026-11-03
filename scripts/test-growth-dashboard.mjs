import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/pages/private-operations/[slug]/growth.astro", import.meta.url), "utf8");
const operations = await readFile(new URL("../src/pages/private-operations/[slug].astro", import.meta.url), "utf8");
const match = /<script is:inline type="module">([\s\S]*?)<\/script>/.exec(source);

test("dashboard browser code parses as plain JavaScript", () => {
  assert.ok(match, "dashboard inline script required");
  new vm.Script(match[1]);
});

test("dashboard uses CYPH/1 branding and reuses the gated operations presentation", () => {
  assert.match(source, /<BrandMark\s*\/>/);
  assert.match(source, /privateOperationsPresentation/);
  assert.match(source, /getStaticPaths/);
  assert.match(source, /noindex, nofollow, noarchive/);
  assert.match(source, /--cyph-accent-primary/);
  assert.match(source, /GROWTH/);
  assert.match(operations, /Growth dashboard/);
});

test("dashboard never sends mutations or embeds fabricated prospects", () => {
  assert.match(source, /\/operations\/growth\/prospects/);
  assert.match(source, /credentials: 'include'/);
  assert.match(source, /readOnly !== true/);
  assert.match(source, /response.status === 401 \|\| response.status === 403/);
  assert.match(source, /No prospect research has been imported yet/);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|DELETE|PATCH)['"]/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test("dashboard has accessible filters, status and review details", () => {
  for (const id of ["channel", "status-filter", "search"]) {
    assert.match(source, new RegExp('for="' + id + '"'));
    assert.match(source, new RegExp('id="' + id + '"'));
  }
  assert.match(source, /id="status-message" role="status" aria-live="polite"/);
  assert.match(source, /aria-labelledby="detail-title"/);
  assert.match(source, /<th scope="col">/);
  assert.match(source, /safeSource/);
});

test("IPL evidence is displayed only in the isolated development dashboard", () => {
  assert.match(source, /environment === "development" && <th scope="col">IPL EXPERIENCE<\/th>/);
  assert.match(source, /environment === "development" && <div class="ipl-detail"/);
  assert.match(source, /if \(isDevelopment\) tr\.append\(el\('td', record\.iplExperience/);
  assert.match(source, /iplExperience/);
  assert.match(source, /detail-ipl-source/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test("development dashboard separates prospect from clickable social source without changing production table", () => {
  assert.match(source, /<th scope="col">PROSPECT<\/th>/);
  assert.match(source, /environment === "development" && <th scope="col">SOURCE<\/th>/);
  assert.match(source, /const platformInfo = value =>/);
  for (const host of ["instagram.com", "tiktok.com", "youtube.com", "facebook.com", "linkedin.com", "x.com"]) {
    assert.ok(source.includes("'"+host+"'"));
  }
  assert.match(source, /link\.href = info\.href/);
  assert.match(source, /link\.target = '_blank'/);
  assert.match(source, /link\.rel = 'noopener noreferrer'/);
  assert.match(source, /opens in a new tab/);
  assert.match(source, /source\.append\(el\('span', 'Source unavailable'\)\)/);
  assert.match(source, /if \(isDevelopment\) \{/);
  assert.match(source, /name\.append\(el\('small', new URL\(record\.sourceUrl\)\.hostname\)\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});
