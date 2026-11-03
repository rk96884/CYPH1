# CYPH/1 Growth Agent — foundation (research only)

## Objective
Find and qualify publicly documented UK creator and commercial partner prospects for CYPH/1's **£74.99 launch-price** IPL device. Direct consumer acquisition uses aggregate search demand and consented site analytics; **never scrape or infer individual consumer identities or contact details**.

## Current scope
- `qualification.mjs` provides deterministic, evidence-based scoring for `creator` and `partner` prospects.
- Scoring weights are deliberately preliminary; reviewed evidence matters more than a superficially high score.
- Missing evidence receives zero points and lowers confidence.
- No API calls, automated scraping, database writes, outreach, imports, or UI exposure.
- No prospect may be contacted automatically: `outreachAllowed` always returns `false`.
- Validate the module with `node --test tools/growth-agent/qualification.test.mjs`.

## Proposed next implementation slices
1. Read-only prospect ingestion: explicit approved public sources only, provenance URLs, capture dates, deduplication and rate limits; no contact-list harvesting.
2. Dedicated database migration in the existing Render Postgres environment for sources, prospects, evidence, review status, audit history, suppression rules and research-job runs. No changes to order or payment tables.
3. Protected operations API and admin view using the project's existing Cloudflare Access authentication plus an explicit `growth:read`/`growth:review` grant model (deny by default). Do not expose on public Astro pages.
4. AI extraction/summary jobs with schema validation, spend caps, model outputs treated as untrusted, source-level checks and manual review.
5. Manual-only draft generation, legal/contact-route review and campaign attribution. No outbound sending or publication without an explicit subsequent decision.
6. Aggregate SEO acquisition research using Search Console when authorised.

## Proposed pilot checks
- Find 50 UK creators, 30 relevant UK business prospects and 15 SEO opportunities.
- Review evidence quality and false-positive rate before expanding search.
- Draft up to 20 reviewed introductions only if compliance and product-readiness gates are met.
- Track qualified leads, replies, attributable conversions, and cost **per profitable sale**.
- Assess landed device cost, fees, shipping, expected returns, warranty and tax before setting an affiliate commission; never derive affordability from the £74.99 retail price alone.

## Safety and privacy boundaries
- No unsolicited consumer email/DM campaigns; apply UK PECR and UK GDPR rules, suppression lists and opt-out handling to any approved B2B programme.
- Store the minimum required business data, including source and retention metadata. Do not infer protected characteristics.
- Never grant this agent access to customer order records, payment credentials, fulfilment controls, production secrets or deploy permissions.
- Approved product claims only; creator adverts and gifts require suitable disclosure.
- External data providers and their terms, pricing and regulatory basis must be checked before activation.

## Example
```js
import { qualifyProspect } from "./qualification.mjs";
const record = qualifyProspect({
  name: "Example UK creator",
  channel: "creator",
  sourceUrl: "https://example.org/creator",
  sourceCheckedAt: "2026-11-03",
  evidence: {
    relevance: { rating: 4, sourceUrl: "https://example.org/post", note: "Publishes IPL education" }
  }
});
// record.score === 24, confidence === 0.2, outreachAllowed === false
```

This foundation deliberately does **not** claim discovery, production integration, migrations, or real prospect results are complete.
