import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
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
 assert.doesNotMatch(s,/(guaranteed|100% painless|permanent hair removal|clinically proven CYPH\/1)/i);
 assert.doesNotMatch(s,/Offer|aggregateRating/);
 assert.match(s,/datePublished: "2026-11-04"/);
});

test("UK price examples are dated, sourced, and not equivalent efficacy promises",async()=>{
 const s=await read("src/pages/learn/ipl-vs-laser-hair-removal.astro");
 assert.match(s,/How much does at-home IPL cost compared with clinic laser/);
 assert.match(s,/£199\.99–£349\.99/);
 assert.match(s,/£100–£369/);
 assert.match(s,/£1,100/);
 assert.match(s,/Prices observed 4 November 2026/);
 assert.match(s,/not evidence of equivalent clinical results or guaranteed savings/);
 assert.match(s,/https:\/\/www\.laser-skin\.co\.uk\/pricing\//);
 assert.match(s,/https:\/\/www\.pulselightclinic\.co\.uk\/laser-hair-removal-prices/);
 assert.doesNotMatch(s,/technology-visuals|photography-note|ipl-treatment-editorial\.webp|laser-treatment-editorial\.webp/);
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
