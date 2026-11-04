import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const root=new URL("../",import.meta.url);
const read=p=>readFile(new URL(p,root),"utf8");
const route="learn/ipl-vs-shaving-vs-waxing/";

test("article explains distinct mechanisms, limitations and sourced safety",async()=>{
 const s=await read(`src/pages/${route.slice(0,-1)}.astro`);
 for(const text of ["IPL vs Shaving vs Waxing", "A blade cuts hair at the skin surface", "pulls them out from the root", "pigment", "contraindications", "patch-testing", "retinoids", "not proof", "anagen", "catagen", "telogen", "exogen"]) assert.ok(s.includes(text),text);
 for(const domain of ["www.aad.org","www.arpansa.gov.au","www.gov.uk","thecoventgardensalon.com"]) assert.ok(s.includes(domain));
 assert.doesNotMatch(s,/100% hair removal|clinically proven|guaranteed savings|FDA approved/i);
});

test("rendered 12-month model includes shaving alongside IPL and explains assumptions",async()=>{
 const html=await read(`dist/${route}index.html`);
 for(const text of ["£36.00","£110.99","£360.00","£74.99","intended pre-launch price","modelling allowance","not a sourced retail price","not the salon's recommended frequency","not clinically equivalent","Savings or outcomes cannot be guaranteed","exclude electricity","2026-11-04"]) assert.ok(html.includes(text),text);
 assert.match(html,/£3\.00 a month/);
 assert.match(html,/£30\.00 × 12 appointments/);
 const s=await read(`src/pages/${route.slice(0,-1)}.astro`);
 assert.match(s,/launchProduct\.intendedPrice\.amount \+ shavingYear/);
});

test("rendered page has indexable SEO, semantic table, accessible image and intact fragments",async()=>{
 const html=await read(`dist/${route}index.html`);
 assert.match(html,/rel="canonical" href="https:\/\/www.cyph1.co.uk\/learn\/ipl-vs-shaving-vs-waxing\/"/);
 assert.match(html,/property="og:title"/);
 assert.match(html,/"@type":"Article"/);
 assert.doesNotMatch(html,/noindex|"@type":"Offer"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/aria-label="IPL, shaving and waxing comparison table"/);
 assert.match(html,/tabindex="0"/);
 assert.equal((html.match(/scope="col"/g)||[]).length,4);
 assert.equal((html.match(/scope="row"/g)||[]).length,6);
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]),m[1]);
 const image=html.match(/<img[^>]+alt="Illustrative comparison:[^"]+"[^>]*>/)?.[0];
 assert.ok(image,"Editorial hero image must have meaningful alt text");
 for(const attr of ['width="1400"','height="788"','loading="eager"','decoding="async"']) assert.ok(image.includes(attr),attr);
 assert.ok(image.includes("cyph1-ipl-shaving-waxing-hero.webp"),"Approved editorial WebP must be used");
});

test("article links to the education cluster and is linked contextually",async()=>{
 const s=await read(`src/pages/${route.slice(0,-1)}.astro`);
 for(const target of ["hair-growth-cycle/","why-ipl-consistency-matters/","ipl-vs-laser-hair-removal/","ipl-hair-removal/"]) assert.ok(s.includes(target));
 for(const file of ["ipl-vs-laser-hair-removal","why-ipl-consistency-matters"]) assert.ok((await read(`src/pages/learn/${file}.astro`)).includes(route));
});

test("article heading reveals reuse progressive enhancement and respect reduced motion",async()=>{
 const s=await read(`src/pages/${route.slice(0,-1)}.astro`);
 const headings=[...s.matchAll(/<h[12]\b[^>]*>/g)].map(m=>m[0]);
 assert.ok(headings.length>1);
 assert.ok(headings.every(h=>h.includes("data-reveal")));
 assert.match(s,/prefers-reduced-motion: reduce/);
 assert.match(s,/!\("IntersectionObserver" in window\)/);
 assert.match(s,/observer\.unobserve\(entry\.target\)/);
 assert.match(s,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(s,/animation:none!important/);
 assert.doesNotMatch(s,/\[data-reveal\]\s*\{[^}]*opacity:\s*0\s*[;}]/);
});
