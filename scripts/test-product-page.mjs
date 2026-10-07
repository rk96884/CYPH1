import assert from "node:assert/strict";
import test from "node:test";
import { readFile, access } from "node:fs/promises";
const html = await readFile(new URL("../dist/ipl-hair-removal/index.html", import.meta.url), "utf8");

test("launch kit contains only the five manual-backed items", () => {
  const kit = html.match(/<ul id="launch-kit-contents"[^>]*>(.*?)<\/ul>/s)?.[1];
  assert.ok(kit);
  const items = [...kit.matchAll(/<li>(.*?)<\/li>/g)].map(([, text]) => text);
  assert.deepEqual(items, ["CYPH/1 IPL Hair Removal Device", "Power adaptor", "Protective goggles", "User manual and guidance card", "Razor"]);
});

test("manufacturer guidance preserves treatment and compatibility boundaries", () => {
  const block = id => html.match(new RegExp(`id="${id}"[\\s\\S]*?</(?:article|div)>`))?.[0];
  assert.match(block("areas-women"), /Upper lip · Chin · Underarms · Arms · Legs · Bikini area/);
  assert.match(block("areas-men"), /Chest · Back · Arms · Abdomen · Legs/);
  assert.doesNotMatch(block("areas-men"), /lip|Chin|facial/i);
  for (const [id, labels] of [
    ["skin-suitable", ["White", "Beige", "Light brown", "Mid brown"]],
    ["skin-unsuitable", ["Dark brown", "Brownish black"]],
    ["hair-suitable", ["Black", "Dark brown", "Brown", "Light brown"]],
    ["hair-unsuitable", ["Light blonde", "Red", "White"]],
  ]) {
    const content = block(id);
    assert.ok(content);
    for (const label of labels) assert.ok(content.includes(`<span>${label}</span>`));
    assert.equal([...content.matchAll(/aria-hidden="true"/g)].length, labels.length);
  }
  assert.doesNotMatch(html, /Fitzpatrick|Treatment-area guide coming soon|Face: 1|Legs: 8|twice|2 times/i);
});

test("confirmed controls and concise safety guidance render without outcome claims", () => {
  for (const text of ["Manual and automatic flash modes", "Selectable energy levels", "Delivers two flashes in quick succession for an enhanced treatment mode.", "Automatic shut-off after 5 minutes of inactivity", "tattoos, sunburn, dark spots or moles", "Do not use during pregnancy", "Shave the treatment area", "skin is clean and dry", "Do not wax or pluck", "supplied protective eyewear", "Read the complete instructions"]) assert.ok(html.includes(text), text);
});

test("product renders the approved intended price and explicit pre-launch state", () => {
  assert.match(html, /CYPH\/1 IPL Hair Removal Device/);
  assert.match(html, /£74\.99/);
  assert.match(html, /Intended launch price/);
  assert.match(html, /Pre-launch · Coming soon/);
  assert.match(html, /Not yet available to purchase/);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
});

test("launch CTAs reuse the existing signup; no commerce integration is emitted", () => {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>Join the launch list<\/a>/g)];
  assert.equal(links.length, 2);
  assert.ok(links.every(([, href]) => href.endsWith("/#early-access")));
  assert.doesNotMatch(html, /<form\b|<button\b|private-commerce|data-checkout|add to cart|buy now|api\/checkout/i);
});

test("Product schema contains no offer, availability or unapproved claims", () => {
  const json = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  assert.ok(json);
  const schema = JSON.parse(json[1]);
  assert.equal(schema["@type"], "Product");
  for (const key of ["offers", "availability", "review", "aggregateRating", "shippingDetails", "hasMerchantReturnPolicy", "sku"]) assert.equal(schema[key], undefined);
  assert.doesNotMatch(html, /IONKA|K-803|999,999|painless|5°C|510.1200|90%|InStock|salon-style/i);
});

test("all eight information sections and seven ordered Astro gallery assets render without upscaling", async () => {
  for (const id of ["product-introduction", "features-heading", "areas-heading", "included-heading", "science-heading", "safety-heading", "information-heading", "launch-heading"]) assert.ok(html.includes(`id="${id}"`));
  assert.equal([...html.matchAll(/<figure class="gallery-frame/g)].length, 7);
  const gallery = html.match(/<div class="product-gallery"[\s\S]*?<\/figure>\s*<\/div>/)?.[0];
  assert.ok(gallery);
  const images = [...gallery.matchAll(/<img\b[^>]*>/g)].map(([image]) => image);
  assert.equal(images.length, 7);
  assert.doesNotMatch(gallery, /gallery-placeholder|Image coming soon/);
  const expected = [
    ["hero-v1", 379, 453, "CYPH/1 IPL Hair Removal Device with accessories"],
    ["whats-included", 378, 454, "CYPH/1 IPL device with included accessories"],
    ["cooling", 377, 455, "CYPH/1 IPL device cooling treatment window"],
    ["treatment-areas", 1137, 1383, "At-home IPL treatment areas"],
    ["technology", 528, 445, "IPL and hair-growth-cycle illustration"],
    ["at-home", 497, 445, "At-home IPL hair removal"],
    ["design", 490, 445, "CYPH/1 IPL device rose-gold detail"],
  ];
  const { default: sharp } = await import("sharp");
  for (const [index, image] of images.entries()) {
    const [filename, width, height, alt] = expected[index];
    assert.ok(image.includes(`alt="${alt}"`));
    const renderedWidth = index === 0 ? width : Math.min(640, width);
    assert.ok(image.includes(`width="${renderedWidth}"`));
    assert.ok(image.includes(`height="${Math.round(height * renderedWidth / width)}"`));
    assert.ok(image.includes(`loading="${index === 0 ? "eager" : "lazy"}"`));
    const src = image.match(/\bsrc="([^"]+)"/)?.[1];
    assert.ok(src?.includes(`/_astro/cyph1-ipl-${filename}.`) && src.endsWith(".webp"));
    const srcset = image.match(/\bsrcset="([^"]+)"/)?.[1];
    assert.ok(srcset);
    for (const candidate of srcset.split(",")) {
      const [, url, descriptor] = candidate.trim().match(/^(\S+) (\d+)w$/) ?? [];
      assert.ok(url);
      assert.ok(Number(descriptor) <= width);
      const output = new URL(`../dist${url.slice(url.indexOf("/_astro/"))}`, import.meta.url);
      const metadata = await sharp(await readFile(output)).metadata();
      assert.equal(metadata.width, Number(descriptor));
      assert.ok(metadata.width <= width && metadata.height <= height);
    }
  }
  assert.match(html, /learn\/hair-growth-cycle\//);
  assert.match(html, /learn\/why-ipl-consistency-matters\//);
});
test("returns draft and default private purchase page remain unpublished", async () => {
  for (const path of ["../dist/returns/index.html", "../dist/private-commerce/index.html"]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});

test("Turbo description does not imply doubled results, speed or power", () => {
  assert.match(html, /<h3>Turbo Mode<\/h3>/);
  assert.doesNotMatch(html, /2[×x] (?:more effective|better results|more powerful)|twice as (?:fast|much hair)|faster results/i);
});

const home = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
test("homepage and shared navigation expose the pre-launch product route", async () => {
  assert.match(home, /Meet the CYPH\/1 IPL/);
  assert.match(home, /href="\/ipl-hair-removal\/">Discover the device<\/a>/);
  for (const page of [home, html]) {
    const nav = page.match(/<nav aria-label="Primary navigation">(.*?)<\/nav>/s)?.[1];
    assert.ok(nav);
    assert.match(nav, /class="product-nav-link" href="\/ipl-hair-removal\/">IPL Device<\/a>/);
    assert.doesNotMatch(page, /buy now|shop now|add to cart|order now|in stock|href="[^"]*(?:api\/checkout|private-commerce)[^"]*"/i);
  }
  const sitemap = await readFile(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");
  assert.equal([...sitemap.matchAll(/<loc>[^<]*\/ipl-hair-removal\/<\/loc>/g)].length, 1);
});

test("gallery prioritises only the hero and defers responsive desktop previews", () => {
  const gallery = html.match(/<div class="product-gallery"[\s\S]*?<\/figure>\s*<\/div>/)?.[0];
  assert.ok(gallery);
  assert.equal([...gallery.matchAll(/loading="lazy"/g)].length, 6);
  assert.equal([...gallery.matchAll(/fetchpriority="high"/g)].length, 1);
  assert.equal([...gallery.matchAll(/data-gallery-preview-srcset=/g)].length, 6);
  assert.match(gallery, /calc\(30\.6667vw - 10px\)/);
  assert.doesNotMatch(gallery, /sizes="\(min-width: 960px\) 16vw, 50vw"/);
});
