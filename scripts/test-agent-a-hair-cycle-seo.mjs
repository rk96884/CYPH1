import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");
test("hair growth article answers measured UK queries without unapproved claims",async()=>{
 const s=await read("src/pages/learn/hair-growth-cycle.astro");
 assert.match(s,/What are the stages of hair growth\?/);
 assert.match(s,/Three stages or four\?/);
 assert.match(s,/anagen, catagen and telogen/);
 assert.match(s,/Exogen names the shedding/);
 assert.match(s,/Does every hair grow at the same time\?/);
 assert.match(s,/does not establish the growth phase/);
 assert.match(s,/dateModified: "2026-11-04"/);
 assert.match(s,/Journal of Clinical Medicine — Integrative and Mechanistic/);
 assert.doesNotMatch(s,/International Journal of Molecular Sciences — Hair Growth Cycle and Hair Loss/);
});
test("relevant core pages have contextual links to hair-cycle content",async()=>{
 const [home,product,cycle,consistency]=await Promise.all([
 read("src/pages/index.astro"),read("src/pages/ipl-hair-removal.astro"),
 read("src/pages/learn/hair-growth-cycle.astro"),read("src/pages/learn/why-ipl-consistency-matters.astro")
 ]);
 assert.match(home,/Learn the stages of hair growth/);
 assert.match(home,/Why a consistent IPL routine matters/);
 assert.match(product,/Learn the four hair-growth phases/);
 assert.match(product,/Understand why IPL consistency matters/);
 assert.match(cycle,/Explore the CYPH\/1 at-home IPL device \(pre-launch\)/);
 assert.match(consistency,/Start with the four stages of the hair-growth cycle/);
 assert.doesNotMatch(cycle,/guaranteed hair removal|permanently removes all hair/i);
});
