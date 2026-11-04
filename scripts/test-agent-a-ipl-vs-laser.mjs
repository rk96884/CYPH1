import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import sharp from "sharp";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");

test("IPL vs laser is educational, indexable and explicit about differences and limits",async()=>{
 const s=await read("src/pages/learn/ipl-vs-laser-hair-removal.astro");
 assert.match(s,/IPL vs Laser Hair Removal: Key Differences/);
 assert.match(s,/filtered, broad-spectrum flash/);
 assert.match(s,/IPL is not a laser/);
 assert.match(s,/Hair-reduction principle/);
 assert.match(s,/aria-label="IPL and laser technology comparison table"/);
 assert.match(s,/Do not assume permanent, complete or pain-free results/);
 assert.match(s,/This guide compares general technologies/);
 assert.match(s,/https:\/\/www\.asa\.org\.uk\/advice-online\/hair-hair-removal\.html/);
 assert.match(s,/https:\/\/www\.gov\.uk\/government\/publications\/guidance-on-the-safe-use-of-lasers/);
 assert.doesNotMatch(s,/(guaranteed hair removal|100% painless|permanent hair removal|clinically proven CYPH\/1)/i);
 const structured=s.match(/const structuredData = \{[\s\S]*?\n\};/)?.[0];
 assert.ok(structured,"Article structured data must remain present");
 assert.match(structured,/"@type": "Article"/);
 assert.doesNotMatch(structured,/Offer|aggregateRating|priceCurrency|offers/);
 assert.match(s,/datePublished: "2026-11-04"/);
});

test("UK price examples are dated, sourced, and not equivalent efficacy promises",async()=>{
 const s=await read("src/pages/learn/ipl-vs-laser-hair-removal.astro");
 assert.match(s,/How much does at-home IPL cost compared with clinic laser/);
 assert.match(s,/£199\.99–£295/);
 assert.match(s,/earlier Argos example recorded for Braun Pro 5 was £349\.99/);
 assert.match(s,/£100–£369/);
 assert.match(s,/£1,100/);
 assert.match(s,/Prices observed <time datetime="2026-11-04">4 November 2026<\/time>/);
 assert.match(s,/not evidence of equivalent clinical results or guaranteed savings/);
 assert.match(s,/A device purchase and a professional treatment course are not clinically equivalent/);
 assert.match(s,/Savings or outcomes cannot be guaranteed/);
 assert.match(s,/Women's underarms · 6 sessions/);
 assert.match(s,/London underarms · 6 sessions · offer/);
 assert.match(s,/Women's full body · 6 sessions/);
 assert.match(s,/Ulike Air 3/);
 assert.match(s,/BRI955\/01 · Argos/);
 assert.match(s,/PL5124 · Currys/);
 assert.match(s,/https:\/\/www\.laser-skin\.co\.uk\/pricing\//);
 assert.match(s,/https:\/\/www\.pulselightclinic\.co\.uk\/laser-hair-removal-prices/);
 assert.match(s,/https:\/\/www\.argos\.co\.uk\/product\/2657633/);
 assert.match(s,/https:\/\/www\.currys\.co\.uk\/products\/braun-silkexpert-pro-5-pl5124/);
 assert.match(s,/https:\/\/www\.independent\.co\.uk\/extras\/indybest/);
 const costSection=s.match(/<section class="section article-section cost-section"[\s\S]*?<\/section>\s*<\/div>\s*<div class="cost-summary/)?.[0];
 assert.ok(costSection,"cost comparison panels must be present");
 assert.doesNotMatch(costSection,/<table\b/);
});

test("CYPH/1 price reuses approved product data and is explicitly pre-launch",async()=>{
 const [s,product]=await Promise.all([read("src/pages/learn/ipl-vs-laser-hair-removal.astro"),read("src/data/launch-product.ts")]);
 assert.match(product,/amount: 74\.99, currency: "GBP"/);
 assert.match(s,/launchProduct\.intendedPrice\.amount/);
 assert.match(s,/Intended launch price · Pre-launch/);
 assert.match(s,/CYPH\/1's £74\.99 is an intended pre-launch price, not a live offer/);
 assert.match(s,/Not yet available to buy/);
});

test("visual comparison uses the supplied text-free lifestyle image and licensed clinic photo",async()=>{
 const [s,provenance]=await Promise.all([read("src/pages/learn/ipl-vs-laser-hair-removal.astro"),read("src/assets/editorial/ipl-vs-laser/README.md")]);
 assert.match(s,/import homeIplLifestyle from "\.\.\/\.\.\/assets\/editorial\/ipl-vs-laser\/device-in-use\.webp"/);
 assert.match(s,/<Image src=\{homeIplLifestyle\} format="webp"/);
 assert.match(s,/<Image src=\{clinicLaserPhoto\} format="webp"/);
 assert.equal((s.match(/widths=\{\[320, 480, 640, 960, 1200\]\} sizes=\{comparisonImageSizes\}/g)||[]).length,2);
 assert.equal((s.match(/loading="lazy" decoding="async"/g)||[]).length,2);
 assert.match(s,/aspect-ratio:4 \/ 3/);
 assert.match(s,/object-fit:contain/);
 assert.match(s,/Final production appearance remains subject to approval/);
 assert.match(s,/Not treatment guidance or evidence of results/);
 assert.match(s,/alt="A woman holding a white and rose-gold at-home IPL device/);
 assert.match(s,/alt="A gloved practitioner holding a professional laser/);
 assert.ok(s.indexOf('class="technology-visuals"')<s.indexOf('<table class="technology-table">'));
 assert.doesNotMatch(s,/ipl-treatment-editorial\.webp|<svg\b/);
 assert.match(provenance,/https:\/\/www\.pexels\.com\/license\//);
 assert.match(provenance,/Kerim Eveyik/);
 const [product,clinic]=await Promise.all([
   sharp(fileURLToPath(new URL("src/assets/editorial/ipl-vs-laser/device-in-use.webp",root))).metadata(),
   sharp(fileURLToPath(new URL("src/assets/editorial/ipl-vs-laser/laser-treatment.webp",root))).metadata()
 ]);
 assert.equal(product.format,"webp"); assert.equal(clinic.format,"webp");
 assert.ok(product.width>=1200&&clinic.width>=1200,"responsive candidates must not upscale");
});

test("product and educational pillars link to the comparison guide",async()=>{
 const [product,cycle,consistency]=await Promise.all([
   read("src/pages/ipl-hair-removal.astro"),
   read("src/pages/learn/hair-growth-cycle.astro"),
   read("src/pages/learn/why-ipl-consistency-matters.astro")
 ]);
 assert.match(product,/withBase\("learn\/ipl-vs-laser-hair-removal\/"\)/);
 assert.match(cycle,/href="\/learn\/ipl-vs-laser-hair-removal\/"/);
 assert.match(consistency,/href="\/learn\/ipl-vs-laser-hair-removal\/"/);
 assert.match(product,/Intended launch price/);
});
