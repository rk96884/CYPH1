import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { auditPerformance, INITIAL_BUDGET, selectImage, lengthPixels } from "./audit-performance.mjs";

async function fixture(t, files) {
  const dir = await mkdtemp(join(tmpdir(), "cyph-performance-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), content); }
  return dir;
}
const scenario = [{ width: 320, dpr: 1 }];

test("pages are independently budgeted even when their union exceeds 200 KiB", async t => {
  const dir = await fixture(t, { "index.html": '<img src="/one.webp">', "second/index.html": '<img src="/two.webp">', "one.webp": randomBytes(120 * 1024), "two.webp": randomBytes(120 * 1024) });
  const result = await auditPerformance(dir, scenario);
  assert.ok(result.siteGzip > INITIAL_BUDGET);
  assert.equal(result.failures.length, 0);
  assert.equal(result.pages.length, 2);
  assert.equal(result.resources.filter(r => r.path.endsWith(".html")).length, 2);
});

test("navigation and deliberate full-size links never become initial downloads", async t => {
  const dir = await fixture(t, { "index.html": '<a href="/full.webp">View image</a><a href="/other/">Other</a><a href="/other/index.html">Other document</a><img src="/thumb.webp">', "other/index.html": 'Other page', "full.webp": randomBytes(300 * 1024), "thumb.webp": randomBytes(1000) });
  const result = await auditPerformance(dir, scenario);
  const page = result.pages.find(p => p.path === "index.html");
  assert.deepEqual(page.worst.resources.sort(), ["index.html", "thumb.webp"]);
  assert.ok(result.resources.some(r => r.path === "full.webp"));
  assert.equal(result.failures.length, 0);
});

test("lazy images are reported separately while eager/default images are charged", async t => {
  const dir = await fixture(t, { "index.html": '<img loading="lazy" src="/lazy.webp"><img loading="eager" src="/hero.webp"><img src="/logo.svg">', "lazy.webp": randomBytes(300 * 1024), "hero.webp": randomBytes(2000), "logo.svg": '<svg/>' });
  const result = await auditPerformance(dir, scenario), page = result.pages[0];
  assert.ok(page.lazyMaxGzip > INITIAL_BUDGET);
  assert.deepEqual(page.worst.resources.sort(), ["hero.webp", "index.html", "logo.svg"]);
  assert.equal(result.failures.length, 0);
});

test("responsive images select viewport/DPR candidates rather than the fallback", async t => {
  const dir = await fixture(t, { "index.html": '<img src="/full.webp" srcset="/small.webp 320w, /medium.webp 640w, /full.webp 1600w" sizes="(min-width: 960px) 640px, 100vw">', "small.webp": randomBytes(1000), "medium.webp": randomBytes(2000), "full.webp": randomBytes(300 * 1024) });
  const result = await auditPerformance(dir, [{width: 320, dpr: 1}, {width: 320, dpr: 2}, {width: 1366, dpr: 1}]);
  assert.ok(result.pages[0].estimates[0].resources.includes("small.webp"));
  assert.ok(result.pages[0].estimates[1].resources.includes("medium.webp"));
  assert.ok(result.pages[0].estimates[2].resources.includes("medium.webp"));
  assert.equal(result.failures.length, 0);
  assert.equal(selectImage({srcset:"a.webp 1x, b.webp 2x"}, {width:320,dpr:2}), "b.webp");
  assert.equal(lengthPixels("calc((100vw - 40px) / 2)", 320), 140);
  assert.equal(lengthPixels("min(80rem, calc(100vw - 2 * clamp(20px, 4vw, 64px)))", 1920), 1280);
});

test("the product route is not exempt: an oversized initial image fails", async t => {
  const dir = await fixture(t, { "ipl-hair-removal/index.html": '<img src="/hero.webp">', "hero.webp": randomBytes(210 * 1024) });
  const result = await auditPerformance(dir, scenario);
  assert.equal(INITIAL_BUDGET, 204800);
  assert.match(result.failures.join("\n"), /ipl-hair-removal\/index.html: compressed initial payload exceeds 200.0 KiB/);
});

test("stylesheet dependencies, inline fonts and script imports are initial resources", async t => {
  const dir = await fixture(t, { "index.html": '<link rel="stylesheet" href="/styles/main.css"><style>@font-face{src:url("/font.woff2")}</style><script type="module" src="/app.js"></script>', "styles/main.css": '@import "extra.css";body{background:url("../background.webp")}', "styles/extra.css": 'p{color:red}', "font.woff2": randomBytes(1000), "background.webp": randomBytes(1000), "app.js": 'import "./dependency.js";', "dependency.js": 'console.log("loaded")' });
  const result = await auditPerformance(dir, scenario);
  assert.deepEqual(result.pages[0].worst.resources.sort(), ["app.js", "background.webp", "dependency.js", "font.woff2", "index.html", "styles/extra.css", "styles/main.css"]);
  assert.ok(result.failures.every(f => f.startsWith("unexpected generated JavaScript:")));
});

test("picture media selection and image preloads use responsive candidates", async t => {
  const dir = await fixture(t, { "index.html": '<link rel="preload" as="image" href="/large.webp" imagesrcset="/small.webp 320w, /large.webp 1600w" imagesizes="100vw"><picture><source media="(max-width: 500px)" srcset="/small.webp 320w"><img src="/large.webp"></picture>', "small.webp": randomBytes(1000), "large.webp": randomBytes(300 * 1024) });
  const result = await auditPerformance(dir, scenario);
  assert.deepEqual(result.pages[0].worst.resources.sort(), ["index.html", "small.webp"]);
  assert.equal(result.failures.length, 0);
});

test("missing load-bearing resources and unsupported sizes fail visibly", async t => {
  const dir = await fixture(t, { "index.html": '<img src="/missing.webp">' });
  const result = await auditPerformance(dir, scenario);
  assert.match(result.failures.join("\n"), /Missing load-bearing resource/);
  assert.throws(() => selectImage({srcset:"a.webp 320w",sizes:"banana"}, {width:320,dpr:1}), /Unsupported|Invalid/);
});
