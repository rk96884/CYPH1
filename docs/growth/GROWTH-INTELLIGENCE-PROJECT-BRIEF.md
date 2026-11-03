# CYPH/1 Growth Intelligence — Research & Development Project Brief

**Status:** Development research dashboard operational; evidence-enrichment phase agreed  
**Last updated:** 3 November 2026  
**Owner:** CYPH/1  
**Scope:** UK-focused creator/influencer research, with potential future commercial-partner research  
**Approval boundary:** Research only. **No automatic outreach, publishing, endorsements or customer-data use.**

> This is a living project brief and decision record from the CYPH/1 Growth Agent planning and first live pilot. It describes what has actually been implemented, what was observed in the dashboard, what research has been reported, and what remains unverified. It is not an instruction to contact anybody or to alter production settings.

## 1. Purpose and success criteria

Create a source-backed UK growth-research workflow to identify creators who could be suitable for CYPH/1, a premium at-home IPL hair-removal brand. Prioritise **direct IPL-device experience**, credible explanations of hair-removal technology and hair cycles, UK market relevance, and the practical ability to produce useful educational or demonstration content.

**Definition of a successful research candidate:**
- A real public creator or partner with verified profile identity and dated source links.
- A documented relevance assessment; any IPL experience backed by a specific public article, video or post.
- Evidence for audience geography and engagement **only when actually available**; creator residence does not prove audience location.
- A transparent score and confidence level with missing evidence explicitly identified.
- Human review before any proposal, sample, commercial agreement or contact.

The immediate goal is **better research quality**, not more automation, more leads at any cost, or outreach.

## 2. Agreed operating principles

1. **Research-only by default.** All five pilot records remain `research_only`. Research status is not an endorsement or contact permission.
2. **No automatic outreach.** Do not message, email, post to, or otherwise contact creators without a separately approved outreach process.
3. **Public, attributable evidence.** Store source URL, what it actually supports, and date checked. Distinguish third-party estimates from first-party creator statements and platform insights.
4. **No invented metrics.** Missing IPL experience, UK audience geography, engagement, fees or availability stay **unknown**, never zero-interest or assumed verified.
5. **UK audience ≠ UK creator.** An individual described as UK/London-based does not establish the percentage of their followers in the UK.
6. **Separate product-category evidence.** Treat IPL experience, other laser/light hair-removal coverage, general beauty-device content and general skincare as distinct evidence levels.
7. **Keep development and production separate.** Research imports and dashboard tests take place in the development database. The production commerce services are not repointed.
8. **Least privilege and explicit approval.** A restricted development importer writes reviewed research; a different read-only database role powers the protected dashboard.
9. **Human review of privacy and marketing compliance** is required before future influencer relationships, product gifting, disclosure requirements or advertising claims.

## 3. Current system and completed milestones

| Item | Implemented / observed |
| --- | --- |
| Deterministic creator qualification | `tools/growth-agent/qualification.mjs` |
| Isolated PostgreSQL Growth schema | `growth.research_runs`, `growth.prospects`, `growth.prospect_evidence`, `growth.outreach_drafts`, `growth.audit_log`, `growth.suppression_list` |
| Manual research batch and import safeguards | `tools/growth-agent/import-reviewed.mjs`, `tools/growth-agent/import-first-five-development.mjs` |
| Five-candidate pilot source JSON | `docs/growth/research/first-five-uk-creators.json` |
| Development-only reader | PostgreSQL role `growth_read_dev`: SELECT on prospects and prospect evidence only |
| Development API | Separate Render service `cyph1-growth-api-development`, with enforced development DB/reader identity and read-only database session |
| Protected development dashboard | `https://growth-development-auth.cyph1-preview.pages.dev/private-operations/growth-development/growth/` |
| Development API TLS | Render internal-connection exception scoped to the known private development hostname, not global certificate bypass |
| Website accessibility | Keyboard-focus “Skip to content” link confirmed working as intended |
| First database import | Five creators, six stored evidence records, one completed research run, five audit records verified after import |
| Live dashboard | User confirmed the five creators display correctly after authenticating |
| Production | Existing production commerce services and public website left unchanged during the development work |

**Development database:** `cyph1_commerce_development`.  
**Dashboard reader account:** `growth_read_dev`.  
**Development import account:** `growth_import_dev`.  
**Code-review note:** Password-based preview authentication was chosen instead of creating a paid custom domain and separate Cloudflare Access application. It is a limited development compromise, **not** parity with SSO/MFA. Changes from the Codex development branch are tracked in draft [PR #190](https://github.com/rk96884/CYPH1/pull/190); do not assume they are merged into `main`.

Do not commit administrator passwords, DB URLs, tokens or any file under `tmp/` containing local credentials.

## 4. Current scoring model

The existing **creator** qualification dimensions are:

| Dimension | Maximum points | Interpretation |
| --- | ---: | --- |
| Relevance | 30 | Fit with IPL, hair removal, beauty-technology and education |
| UK audience | 25 | Verifiable UK follower or customer audience, not merely UK creator location |
| Engagement | 20 | Credible, dated and attributable participation/engagement metrics |
| Brand fit | 15 | Credibility, communication style, CYPH/1 suitability |
| Feasibility | 10 | Evidence of potential content collaboration capability; not assumed willingness or rate |
| **Total** | **100** | |

Each dimension has a rating from 0 to 5 and a supporting note and URL. Missing evidence contributes **zero points** to the score and lowers the evidence-coverage confidence. The score is not a prediction of campaign performance.

**Decision:** Add **IPL experience as an explicit research field/classification**, preserving source links and dates. Until a separately reviewed scoring change is implemented, IPL experience should inform the *relevance* dimension and the human priority assessment; it must **not** silently add a sixth score dimension or change weights. Any migration, scorer revision, data backfill or production rollout requires a separate tested PR and explicit review.

## 5. Initial five creators — imported state

The dashboard's verified development pilot scores are the **stored scores**, not the later, provisional research ranking:

| Creator | Instagram | Stored score | Evidence coverage | Status |
| --- | --- | ---: | ---: | --- |
| Nicola Londors | [@nlondors](https://www.instagram.com/nlondors/) | 30/100 | 40% | `research_only` |
| Janet | [@skinandbase](https://www.instagram.com/skinandbase/) | 24/100 | 20% | `research_only` |
| Sharon Harvey | [@backtoyoubeauty](https://www.instagram.com/backtoyoubeauty/) | 24/100 | 20% | `research_only` |
| Sascha Taylor-Curtis | [@beautygeeksascha](https://www.instagram.com/beautygeeksascha/) | 24/100 | 20% | `research_only` |
| Hanna | [@lifeofhanna_](https://www.instagram.com/lifeofhanna_/) | 24/100 | 20% | `research_only` |

These stored scores **have not yet been recalculated** from the new IPL-review research. Do not present new priorities as database score changes.

## 6. IPL-specific research — November 2026 review

### Proposed evidence taxonomy

| Classification | Qualifies when | Does *not* establish |
| --- | --- | --- |
| `ipl_review_confirmed` | Creator's own identifiable published IPL device review, first-person trial or substantive test; record device, source and date | Objective clinical efficacy, independence, willingness to collaborate |
| `ipl_coverage_confirmed` | Public commentary, feature, comparison or recommendation about an IPL device, but no clear personal test | Firsthand hands-on experience |
| `other_hair_removal_tech` | Laser or other at-home hair-removal product covered, clearly distinguished from IPL | An IPL-device review |
| `beauty_device_only` | Other beauty-device/UGC coverage but no sourced IPL evidence | IPL knowledge |
| `no_public_ipl_evidence_found` | No credible review discovered during this search | A claim that no review exists anywhere |
| `needs_verification` | Evidence is ambiguous, outdated, missing a date, or not attributable | Confirmation |

Each finding should include `creator`, `classification`, `device` if named, `sourceUrl`, `publishedAt` if known, `checkedAt`, `evidenceSummary`, `firsthandTestConfirmed`, and `reviewerNotes`. Prefer verified creator-authored primary content; record uncertainty explicitly.

### Candidate-specific findings and next checks

**1. Sascha Taylor-Curtis — highest IPL-specific research priority.** Public beauty-blog coverage discusses the **Ulike Air 10 IPL** and early usage/results; also references other at-home hair-removal technology. This is the strongest reported evidence of relevant product-category familiarity in the pilot. Distinguish IPL coverage from the separately discussed CurrentBody hair-removal **laser** and Tria laser devices; these are not interchangeable technologies.

- Primary article: [Beauty Geek — Beauty Favourites, July 2025](https://beautygeekuk.com/2025/08/beauty-favourites-july-2025.html)
- Further check: confirm her exact first-hand treatment wording, article date, whether a later full IPL review was published, and whether any relationship/sponsorship was disclosed.
- Provisional classification: `ipl_review_confirmed` **subject to source recheck**.

**2. Sharon Harvey — category coverage identified.** Published an April 2020 at-home beauty-treatments article referencing the **Sensica Sensilight Mini** and at-home light-based hair removal. Older category experience is useful but should not be treated as proof of current IPL testing or product-review availability.

- Primary article: [Back to You Beauty — 10 Beauty Treatments You Can Do During Lockdown](https://www.backtoyoubeauty.co.uk/2020/04/10-beauty-treatments-you-can-do-during-lockdown.html)
- Further check: verify whether Sharon personally used/tested the device, confirm the device's technology and whether the article was a recommendation versus hands-on review.
- Provisional classification: `ipl_coverage_confirmed` **subject to source recheck**.

**3. Nicola Londors — strong demonstration/UGC format, IPL experience unverified.**

- Public creator-services reference: [Collabstr profile](https://collabstr.com/nlondors)
- Further check: locate attributable, dated IPL/laser reviews or videos; determine whether product demonstration is a paid UGC offering without presuming availability or price.
- Provisional classification: `no_public_ipl_evidence_found`.

**4. Janet (@skinandbase) — skincare review/education fit, IPL experience unverified.**

- Background directory: [The Social Shepherd — UK Skincare Influencers](https://thesocialshepherd.com/blog/top-skincare-influencers-uk)
- Further check: search attributable content for IPL, Braun Silk-expert, Philips Lumea, Ulike and hair-removal terms; verify audience and engagement separately.
- Provisional classification: `no_public_ipl_evidence_found`.

**5. Hanna (@lifeofhanna_) — skincare/wellness context, IPL experience unverified.**

- Background directory: [Sprout Social — UK Beauty Influencers](https://sproutsocial.com/insights/beauty-influencers-uk/)
- Further check: confirm current public profile and dated beauty-tech content; explore category suitability only with evidence.
- Provisional classification: `no_public_ipl_evidence_found`.

**Research integrity:** These classifications are a decision record from our initial public-source investigation, **not** a completed, independently rechecked research import. Verify the exact device, content and published date against the source before storing a new verified field. “No public evidence found” is not proof of absence. Do not misstate a laser review as an IPL review.

## 7. Engagement and audience: outstanding research

We also agreed to assess follower counts and engagement, but third-party estimates vary by source and date. The conversation surfaced approximate third-party follower estimates for the five creators; these are **not** verified Instagram Insights and should not be entered as fact without capture dates and source URLs.

For each candidate, collect:
- **Audience location:** verified UK share of followers (ideally platform insights supplied voluntarily in a future approved partnership process); otherwise `unknown`.
- **Engagement:** platform, measurement window, post sample, likes/comments/views, calculation method and source. Avoid comparing conflicting or undated vendor “engagement rates” at face value.
- **Content quality:** device explanation, disclosure of gifted/paid products, realistic hair-removal claims, skin-tone/hair-colour suitability, safety and accessibility.
- **Commercial feasibility:** public creator-services information, contact mechanism and proposed deliverables; contact only after separately approved outreach.
- **Freshness:** date checked and links that remain accessible.

Do not inflate `ukAudience` or `engagement` scores based solely on creator directories or location.

## 8. Research priority versus stored numerical rank

**New human research priority after IPL-source discovery:**

1. **Sascha Taylor-Curtis:** investigate direct IPL-device experience and educational treatment content.
2. **Sharon Harvey:** investigate documented older at-home light-based hair-removal coverage.
3. **Nicola Londors:** investigate demonstrable UGC output and any category-specific reviews.
4. **Janet:** investigate strong skincare-review format and possible IPL work.
5. **Hanna:** investigate category evidence and engagement quality before prioritising.

This order is a **research queue**, not an outreach list or a replacement for the deterministic database score.

## 9. Agreed next implementation phase

### Stage A — Verify and record IPL evidence
- Reopen and validate creator-authored primary URLs; identify exact devices, review types, first-person test claims and dates.
- Capture a `no_public_ipl_evidence_found` result with query scope/date when no confirmed evidence appears.
- Review source quality before any change to stored records.

### Stage B — Add structured IPL research metadata
- Propose an explicit `iplExperience` classification with source URL, date, device and content type.
- Decide on storage design (dedicated research table/columns versus structured source evidence); do not overload the existing five weighted dimensions with unsupported claims.
- Add migration, validation, API and dashboard tests; preserve database read-only roles and `research_only` statuses.
- Update development records through the restricted research-import workflow with auditable changes, not direct ad hoc owner writes.
- Update the dashboard to show a clear IPL experience label and clickable evidence when verified.

### Stage C — Improve audience/engagement evidence
- Collect dated, source-backed measurements where legitimately available.
- Recalculate existing qualification scores **only** once supported by the agreed scoring model.
- Assess marketing and advertising-claims risks before approving any outreach workflow.

### Stage D — Optional expansion
- Find more UK micro-influencers with **actual IPL-review history** and relevant audiences, rather than general beauty influencers alone.
- Benchmark against these five pilot candidates before broadening to commercial partners.

## 10. Acceptance criteria for the next release

- [ ] All five candidates have an explicit IPL evidence state, including `unknown` where evidence is insufficient.
- [ ] Positive IPL-review claims link to the relevant attributable dated review, identifying the actual device.
- [ ] Laser and IPL are never conflated.
- [ ] Stored scores remain unchanged until a documented, tested recalculation.
- [ ] Development dashboard displays IPL evidence safely and read-only.
- [ ] No contact information or secrets are written to public client bundles or committed to Git.
- [ ] No automatic outreach, posting, gifting, or production database writes occur.
- [ ] GitHub tests and manual dashboard verification pass.

## 11. Source-of-truth references

- Existing pilot batch: [`docs/growth/research/first-five-uk-creators.json`](research/first-five-uk-creators.json)
- First reviewed import instructions: [`FIRST-FIVE-DEVELOPMENT-IMPORT.md`](FIRST-FIVE-DEVELOPMENT-IMPORT.md)
- Development reader/API deployment instructions: [`GROWTH-DEVELOPMENT-DASHBOARD-CONNECTION.md`](GROWTH-DEVELOPMENT-DASHBOARD-CONNECTION.md)
- Creator scoring implementation: [`tools/growth-agent/qualification.mjs`](../../tools/growth-agent/qualification.mjs)
- Initial source research for Sascha: https://beautygeekuk.com/2025/08/beauty-favourites-july-2025.html
- Initial source research for Sharon: https://www.backtoyoubeauty.co.uk/2020/04/10-beauty-treatments-you-can-do-during-lockdown.html

**Change control:** This document records agreement and research priorities. Implementations and stored evidence updates need separate review, tests and approval. Production is out of scope.
