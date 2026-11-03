# First-five IPL experience verification — 3 November 2026

This note supplements [Growth Intelligence Project Brief](../GROWTH-INTELLIGENCE-PROJECT-BRIEF.md) and is the human-readable review of [`ipl-experience-first-five.json`](ipl-experience-first-five.json).

## Verified primary-source findings

### Sascha Taylor-Curtis — `ipl_review_confirmed`
- **Primary source:** https://beautygeekuk.com/2025/08/beauty-favourites-july-2025.html
- **Published:** 7 August 2025
- **Device:** Ulike Air 10 — IPL.
- **Evidence:** Creator describes personally using the IPL device four times and reports her own initial hair-reduction impressions. She says a full blog review is forthcoming; we **have not confirmed** that subsequent review.
- **Classification nuance:** The verified item is **first-person initial impressions**, not necessarily a standalone long-term independent product review.
- **Disclosure:** Source labels itself an unpaid ad with a mix of PR samples and purchases, and includes affiliate links. The acquisition status of this specific IPL device is not established by the cited article.
- **Caution:** Her personal outcome claims cannot substantiate CYPH/1 marketing efficacy or clinical results.

### Sharon Harvey — `ipl_coverage_confirmed`
- **Primary source:** https://www.backtoyoubeauty.co.uk/2020/04/10-beauty-treatments-you-can-do-during-lockdown.html
- **Published:** 25 April 2020
- **Device:** Sensica Sensilight Mini — at-home light-based IPL category.
- **Evidence:** She recommends using at-home IPL devices and positively describes her own Sensica product. The article mentions treatment cycles, but does **not** establish a detailed firsthand test log or a standalone evidence-led device review.
- **Disclosure:** Article states it includes PR products and affiliate links.
- **Caution:** Older article; no assumptions about current use, commercial availability, audience or interest.

### Remaining creator research
- **Nicola Londors (@nlondors):** `needs_verification`
- **Janet (@skinandbase):** `needs_verification`
- **Hanna (@lifeofhanna_):** `needs_verification`

No verified positive IPL source is stored for these three. This **does not imply they have never reviewed IPL devices**.

## Evidence confidence and implementation boundary

The statuses represent **evidence type**, not creator approval, partnership suitability or inferred campaign performance. They do not automatically affect the existing five-dimension creator scores; IPL work may later inform the existing relevance criterion only after a reviewed scoring proposal.

The current deliverable is an **offline, reviewed research dataset** with a validator and tests. No PostgreSQL migration or import, API field, dashboard update, production deployment, credentials or outreach are included. An additive development-only schema, restricted write workflow, and read-only dashboard display require a subsequent tested implementation and separate approval.

To validate the research batch locally:

```bash
node --test tools/growth-agent/ipl-evidence.test.mjs
node tools/growth-agent/ipl-evidence.mjs
```

This opens **no database connection**.
