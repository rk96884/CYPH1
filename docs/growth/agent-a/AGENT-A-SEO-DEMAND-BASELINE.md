# Agent A — Consumer Demand & SEO Development: Phase 1 baseline

**Date:** 4 November 2026  
**Scope:** UK IPL demand, technical SEO readiness and research-only content gap assessment for CYPH/1  
**State:** **Research only — no publishing or production changes**  
**Evidence:** [Structured baseline with individual sources and review gates](agent-a-baseline-2026-11-04.json)

## 1. Findings and confidence boundaries

We inspected the repository's current `main` branch. The public production homepage was not retrievable through the web research interface, so **the checks below are repository implementation checks**, not live HTTP, indexing or Google Search Console measurements. No Search Console/GA4 data were accessed. A local sitemap implementation does **not** establish any pages as indexed.

### Existing architecture

| Feature | Code evidence | Assessment |
| --- | --- | --- |
| Canonical URLs, English language, titles, description, Open Graph | `src/layouts/BaseLayout.astro` | Present; test production response and Google-chosen canonicals before declaring pass |
| Sitemap | `@astrojs/sitemap` in `astro.config.mjs` | Present; excludes confirmation, privacy, terms and private routes; check actual generated sitemap/Google indexing separately |
| Robots | `public/robots.txt` | Allows crawling and references `https://www.cyph1.co.uk/sitemap-index.xml` |
| Home structured data | `src/pages/index.astro` | `Organization` and `WebSite` present; validate with Google tools before any rich-result expectations |
| Product schema | `src/pages/ipl-hair-removal.astro` | `Product` without `Offer`, price/rating/stock claims intentionally omitted while pre-launch |
| Educational schema | `src/pages/learn/{hair-growth-cycle,why-ipl-consistency-matters}.astro` | `Article` present with date metadata. Verify author attribution and truthful update dates before edits |
| Product page | `/ipl-hair-removal/` | Compatibility swatches, device features, pre-launch information and CTA already present |
| Educational articles | `/learn/hair-growth-cycle/`; `/learn/why-ipl-consistency-matters/` | Good topical foundation. Link new pages to them rather than duplicate near-identical content |
| Press page | `/press/` | Available; **no completed media outreach or backlinks claimed** |
| Conversion confirmation | `/early-access/confirmed/` | `noindex,nofollow` and excluded from sitemap |

**Owner review required:** `src/data/launch-product.ts` currently sets intended price to **£74.99**, which the product-page meta description repeats. Do **not** change or expand price-related messaging until current price/product approval is confirmed.

## 2. What the public demand signals actually tell us

1. [MerchantWords' UK IPL category page](https://www.merchantwords.com/search/uk/ipl%20hair%20removal) shows shopping-intent phrases such as `ipl hair removal device`, `ipl hair removal for men`, `ipl hair removal face`, and competitor terms. Its figures measure **Amazon UK marketplace keyword estimates**, **not Google UK monthly search volume**. We deliberately do not copy numbers into Google-demand fields.
2. [Brandwave's global hair-removal brand report](https://gobrandwave.com/demand/global-en/categories/hair-removal-brands) reports significant **worldwide English-language branded-search interest** in Philips Lumea, Braun and Ulike during September 2026. This does **not** quantify UK Google search opportunity or imply that CYPH/1 can rank for branded competitors.
3. Official [Philips Lumea treatment-frequency support](https://www.philips.co.uk/c-f/XC000003471/how-often-should-i-use-my-philips-lumea), [Braun's UK IPL guide](https://uk.braun.com/en-gb/female-hair-removal/hair-removal-for-women/how-to-ipl) and [Philips results-timeline material](https://www.philips.co.uk/c-e/womens-beauty-blog/hair-removal/ipl-hair-removal-results-timeline) establish a **qualitative evidence-backed set of consumer questions**: treatment frequency, hair-growth phases, expected results, preparing skin and suitability. Their product-specific schedules and efficacy statements **must not be relabelled as CYPH/1 instructions**.

No measured Google Search Console clicks, impressions, CTR, positions or indexing counts are currently available. **No keyword difficulty, CPC, SEO rank or monthly Google search volumes are asserted.**

## 3. Proposed intent clusters (research priority, not a measured keyword score)

| Priority | Cluster and user intent | Current CYPH/1 coverage | Proposed action | Gate |
| --- | --- | --- | --- | --- |
| P1 | **IPL skin-tone and hair-colour suitability** — can I use it? | Product compatibility swatches | Draft a stand-alone suitability explainer with direct links from the product page | Source from approved CYPH/1 manual; human safety review |
| P1 | **IPL vs laser** — what am I buying? | No dedicated page | Draft comparison of light source, mechanism, strengths, limitations and definitions | Scientific claim review, avoid unsupported efficacy comparisons |
| P1 | **IPL results timeline** — when should I expect change? | Consistency article is tangential | Draft a non-guaranteeing educational explainer | No transfer of Braun/Philips results to CYPH/1 |
| P1 | **How often to use IPL** — what routine? | Existing consistency page avoids unapproved schedule | Improve internal explanation and plan a device-specific follow-up | CYPH/1 schedule **blocked** until approved manufacturer instructions |
| P1 / safety gate | **IPL risks, contraindications and patch testing** | Product safety overview | Research-draft first; evaluate suitability of public safety page | Device labelling/UK compliance and medical safety review |
| P2 | **Shaving, preparation and aftercare** | Partial product page coverage | Research safe evergreen FAQ / prep guide | Device manual and contraindications |
| P2 | **At-home IPL vs clinic costs (UK)** — economics | No dedicated comparison | Collect real dated UK prices, create fair illustrative methodology | Price and claims approval; no invented £ savings |
| P2 | **IPL for men** — use areas | Product page has a men section | Add scoped, evidence-safe FAQ; assess dedicated page only after GSC evidence | Approved treatment areas/limitations |

**Suggested first draft to prioritise:** The IPL/laser distinction, as it can explain the category without prescribing a CYPH/1 treatment schedule. **Suggested first product-page improvement to investigate:** Cross-link a clear compatibility explainer based on the verified colour chart already present. Neither is approved for publishing in this phase.

## 4. Technical and editorial risks to resolve first

- **Live verification pending:** Fetch production `/robots.txt`, `/sitemap-index.xml`, canonical/title/description in rendered HTML for the four main SEO pages, redirect behaviour and indexing indicators. The research web client could not access `https://www.cyph1.co.uk/`; that is **not evidence of an outage**.
- **Search Console pending:** Verify ownership/performance access and obtain a dated UK-only export. Use it to distinguish existing ranking pages from new intent gaps. Do not ask a third-party tool to infer Google clicks.
- **Pre-launch product price:** Resolve £74.99 configuration before writing SEO copy on cost/value. An older modelling price must not automatically replace code or vice versa.
- **Medical and safety:** Content must reflect approved device-specific documentation (skin-tone restrictions, hair suitability, treatment areas, contraindications). The supplier's documents or competitor FAQs are not blanket safety clearance.
- **No cannibalisation:** Distinguish `/learn/hair-growth-cycle/` (biology), `/learn/why-ipl-consistency-matters/` (why routines repeat), and proposed `/learn/ipl-treatment-frequency/` (device-specific instruction, presently blocked).
- **No premature rich results:** Product schema deliberately omits `Offer` during pre-launch; do not add unapproved inventory, price, reviews, rating or merchant claims to satisfy validators.

## 5. Agent A implementation roadmap

**Phase A1 — Evidence baseline (this PR):** Existing site map, technical audit, consumer-intent clusters, qualitative public demand evidence, missing data list and editorial gates.

**Phase A2 — Measured opportunity backlog:** Once authorised, read GSC query/page metrics (UK filter, dated period) and optionally UK Keyword Planner *Google Search* estimates; store source, collection date, metric type and confidence. Build reviewable, deduplicated keyword clusters. Without credentials, continue qualitative research with `unknown` volumes, not zero.

**Phase A3 — Research-only content briefs:** Create keyword-intent brief with primary page, searcher question, audience, original sources, internal-link suggestions, approved product-claim requirements and `draft_review` status. Prioritise safety and category knowledge; human approval before shipping content.

**Phase A4 — Read-only Agent A tab in isolated development dashboard:** Reuse existing development infrastructure only if the measured and draft backlog is useful. Do **not** add a second paid service or product-publication rights. Publishing remains manual, separately reviewed and guarded.

### Exit criteria for Phase 1

- [x] Inventory current core public pages and SEO implementation **from code**
- [x] Identify demand themes without falsifying Google UK volume
- [x] Link to primary competitor help and explicit marketplace/global sources
- [x] Write a prioritised content-gap plan and owner/compliance gates
- [ ] Verify live production HTTP, sitemap and Google index status
- [ ] Obtain dated GSC evidence and approve keyword opportunity ordering
- [ ] Confirm product price and device-specific content instructions

**Research-only. No website changes, automated copy publishing, prospect outreach, database migration, checkout, customer-data access or production change.**
