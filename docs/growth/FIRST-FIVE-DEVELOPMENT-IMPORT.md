# First five UK beauty creators — development research-only pilot

## Scope
Five creators are included as **research candidates**, not as approved endorsers or contacts. This pilot uses public profile links and published third-party directories, with no private contact information and no sending of messages. Scores and evidence are necessarily incomplete: UK-based creators do not imply a verified UK audience, and observed followers do not prove current engagement quality.

The fixed batch is `docs/growth/research/first-five-uk-creators.json`. Candidate source URLs and evidence are reviewed and pinned by tests. The workflow rejects unexpected identities, unapproved fields, unverified UK-audience or engagement scores, and requests for outreach.

## Source checks (3 November 2026)
- Janet (@skinandbase): The Social Shepherd, *Top 25 Skincare Influencers in the UK*, https://thesocialshepherd.com/blog/top-skincare-influencers-uk
- Sharon Harvey (@backtoyoubeauty): self-authored About page https://www.backtoyoubeauty.co.uk/about-me ; Feedspot UK over-40 skincare directory https://influencers.feedspot.com/uk_over_40_skincare_instagram_influencers/
- Sascha Taylor-Curtis (@beautygeeksascha): Feedspot UK skincare directory https://influencers.feedspot.com/uk_skincare_instagram_influencers/
- Nicola Londors (@nlondors): Feedspot directory https://influencers.feedspot.com/uk_over_40_skincare_instagram_influencers/ ; own social content/services described at https://collabstr.com/nlondors
- Hanna (@lifeofhanna_): Sprout Social UK beauty guide https://sproutsocial.com/insights/beauty-influencers-uk/

These references support existence and beauty content; there is **no verified evidence of IPL experience, consent to contact, current rates, audience-country percentages, or performance suitability**.

## Workflow
**Actions → Development Growth first-five research import**, branch `main`.

1. Select `action=plan` with an empty confirmation. This loads and qualifies the five published records **without a database connection**, and never writes data.
2. Review displayed names/scores and the source file. If the information requires correction, amend the batch by a separately reviewed PR; do not silently change it during apply.
3. Only after review, select `action=apply` and type `IMPORT-FIVE-RESEARCH-ONLY-DEV`. This authenticates with `growth_import_dev` using secrets in the existing `development-db` GitHub Environment and writes the reviewed research in a single transaction. It is duplicate-safe (skips matching source keys). It never contacts creators.
4. Independently verify with a read-only Render query: `SELECT channel, display_name, review_status, qualification_score, qualification_confidence FROM growth.prospects ORDER BY display_name;` and `SELECT COUNT(*) FROM growth.audit_log WHERE action='research.import';`.

## Security
- No automatically scheduled imports; branch-restricted workflow on `main`.
- The `plan` does not need DB credentials and makes zero DB calls.
- `apply` uses only the pre-existing restricted development login; no production import, owner connection, scraping or outreach.
- No database URI or password is logged, committed, returned to the UI or stored in files.
- The importer emits only a summary with inserted/skipped counts. Review status remains `research_only`.
- The production Growth dashboard is still independent and will not display development research until a separately approved staging/API rollout.
