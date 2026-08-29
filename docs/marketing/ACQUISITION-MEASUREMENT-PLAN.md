# CYPH/1 acquisition measurement plan

**Status:** Ready for implementation  
**Date:** 22 August 2026  
**Related strategy:** [PRE-LAUNCH-TRAFFIC-STRATEGY.md](./PRE-LAUNCH-TRAFFIC-STRATEGY.md)

## Purpose

This plan defines how CYPH/1 will measure pre-launch traffic and early-access acquisition without collecting more personal data than is necessary.

The principal conversion is a **confirmed double-opt-in subscriber**, not a form submission.

## Search readiness audit

| Check | Current status | Action |
| --- | --- | --- |
| Canonical site URL | Ready — `https://www.cyph1.co.uk` | None |
| Canonical page metadata | Ready | Recheck during release QA |
| XML sitemap | Ready — `/sitemap-index.xml` | Submit in Search Console after the exclusion below is corrected |
| Sitemap advertised in `robots.txt` | Ready | None |
| Confirmation page excluded | Ready | None |
| Privacy Notice excluded | Ready | None |
| Website Terms excluded | Needs correction — the page is `noindex` but currently appears in the sitemap | Add `/terms/` to the sitemap filter before submission |
| Google Search Console property | Not yet confirmed | Create a Domain property and verify it through Cloudflare DNS |

## Search Console setup

Use a **Domain property** for `cyph1.co.uk`. This covers the apex domain, `www`, HTTP and HTTPS variants and is verified with a DNS TXT record.

After verification:

1. Open **Indexing → Sitemaps**.
2. Submit `https://www.cyph1.co.uk/sitemap-index.xml`.
3. Inspect `https://www.cyph1.co.uk/` with URL Inspection and request indexing if it is not already indexed.
4. Confirm the canonical selected by Google is the `www` HTTPS URL.
5. Record the baseline below once Search Console begins reporting data.

DNS verification records must be added as **DNS only** records. Do not remove or replace the existing website and email DNS records.

## Conversion definitions

| Stage | Definition | System of record |
| --- | --- | --- |
| Relevant visit | A visit to a campaign destination from an intended audience or search query | Search Console or approved aggregate measurement |
| CTA click | A click on a “Join early access” control | Approved website measurement, if implemented |
| Form submission | A valid request accepted by the early-access Worker | Cloudflare Worker aggregate events |
| Pending subscriber | Contact created but double opt-in not completed | Brevo |
| Confirmed subscriber | Contact completes the confirmation link and joins the approved early-access list | Brevo |
| Unsubscribe | Confirmed contact withdraws marketing consent | Brevo |

## Core calculations

### Confirmed subscriber conversion rate

`confirmed subscribers ÷ relevant visits × 100`

### Double-opt-in completion rate

`confirmed subscribers ÷ accepted form submissions × 100`

### Paid cost per confirmed subscriber

`campaign spend ÷ confirmed subscribers attributed to the campaign`

Do not calculate paid efficiency from unconfirmed form submissions.

## UTM taxonomy

Use lowercase values, ASCII letters and numbers, and hyphens. Do not include names, email addresses or other personal data.

| Parameter | Required | Format | Examples |
| --- | --- | --- | --- |
| `utm_source` | Yes | Platform or named partner | `instagram`, `tiktok`, `pinterest`, `google`, `creator-name` |
| `utm_medium` | Yes | Distribution method | `organic-social`, `paid-social`, `organic-search`, `paid-search`, `creator`, `email` |
| `utm_campaign` | Yes | Stable strategic campaign | `prelaunch-know-the-cycle`, `prelaunch-first-100` |
| `utm_content` | Recommended | Specific creative | `anagen-video-01`, `cycle-carousel-02`, `bio-link` |
| `utm_term` | Paid search only | Keyword or ad-group identifier | `home-ipl-cycle` |

### Example links

Organic Instagram video:

```text
https://www.cyph1.co.uk/?utm_source=instagram&utm_medium=organic-social&utm_campaign=prelaunch-know-the-cycle&utm_content=anagen-video-01
```

Creator collaboration:

```text
https://www.cyph1.co.uk/?utm_source=creator-name&utm_medium=creator&utm_campaign=prelaunch-know-the-cycle&utm_content=cycle-explainer-01
```

Paid search:

```text
https://www.cyph1.co.uk/?utm_source=google&utm_medium=paid-search&utm_campaign=prelaunch-know-the-cycle&utm_content=anagen-ad-01&utm_term=home-ipl-cycle
```

## Campaign link register

Create one row before publishing each tracked link.

| Date | Destination | Source | Medium | Campaign | Content | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | Planned |

The register can begin as a Markdown table and move to a spreadsheet when the number of active links makes that more practical.

## Baseline record

Complete this before the first coordinated traffic campaign. Use a fixed reporting timezone of **Europe/London**.

| Measure | Baseline date | Starting value | Source |
| --- | --- | --- | --- |
| Genuine confirmed early-access subscribers | 22 August 2026 | 0 | Brevo early-access list |
| Internal test subscribers | 22 August 2026 | 1 | Brevo early-access list; excluded from acquisition reporting |
| Pending/unconfirmed contacts | 22 August 2026 | Not available in the early-access list view | Brevo |
| Organic Google clicks, trailing 28 days | 22 August 2026 | Not yet available — new property | Search Console |
| Organic Google impressions, trailing 28 days | 22 August 2026 | Not yet available — new property | Search Console |
| Average organic click-through rate | 22 August 2026 | Not yet available — new property | Search Console |
| Indexed website pages | 22 August 2026 | Processing — new property | Search Console |
| Worker invocations, trailing 7 days | 22 August 2026 | 63 internal test invocations; excluded from acquisition reporting | Cloudflare Worker metrics |
| Worker subrequests, trailing 7 days | 22 August 2026 | 25 internal test subrequests; excluded from acquisition reporting | Cloudflare Worker metrics |
| Worker errors, trailing 7 days | 22 August 2026 | 1 internal test/configuration error; excluded from acquisition reporting | Cloudflare Worker metrics |
| Unsubscribes | 22 August 2026 | 0 visible | Brevo |
| Blocklisted contacts | 22 August 2026 | 0 visible | Brevo |
| Spam complaints | 22 August 2026 | 0 visible | Brevo |

If Search Console has insufficient data, record zero or “not yet available”; do not manufacture a benchmark.

### Baseline qualification

All Worker traffic recorded before and on 22 August 2026 was generated during implementation and verification testing. The single contact in the Brevo early-access list is also an internal test contact. These values must not be counted as genuine acquisition or used to calculate campaign conversion rates.

The first public campaign reporting period therefore begins with **zero genuine confirmed subscribers**. Search Console figures should be added when the property has processed enough data to report them.

## Weekly reporting view

Report by channel and campaign:

- relevant visits or search clicks;
- accepted form submissions;
- confirmed subscribers;
- double-opt-in completion rate;
- confirmed subscriber conversion rate;
- spend and cost per confirmed subscriber, where applicable;
- unsubscribes and complaints;
- strongest content insight; and
- next action: continue, revise, pause or scale.

## Privacy and implementation constraints

- Keep Search Console and platform-level aggregate reporting as the initial measurement layer.
- Do not add non-essential analytics tags, advertising pixels or behavioural retargeting without a separate consent and privacy review.
- Do not expose the Brevo API key, Turnstile secret or subscriber data in the browser or repository.
- Do not store personal data in URLs or UTM parameters.
- Retain the existing double-opt-in and consent evidence.
- If campaign attribution is added to Brevo, document the new contact attributes and pass only allow-listed campaign values through the Worker.
- Avoid relying solely on last-click attribution; record qualitative learnings alongside numeric results.

## Implementation sequence

1. Exclude `/terms/` from the generated sitemap.
2. Build and inspect the resulting sitemap.
3. Create and verify the Search Console Domain property.
4. Submit the sitemap and inspect the homepage.
5. Populate the baseline record from Brevo, Cloudflare and Search Console.
6. Create the first campaign links using the agreed UTM convention.
7. Decide whether campaign-source retention in Brevo is necessary before changing the form or Worker.
