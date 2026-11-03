# Growth Agent — read-only discovery and review API

This is the next staged milestone after the growth schema migration. The **£74.99 launch price** is a planning input and does not change the product's checkout price.

## Included
- Protected `GET /operations/growth/prospects` (optional `?channel=creator|partner`) through the existing Cloudflare Access-authenticated operations runtime.
- New `growth:read` permission accepted by the existing `OPERATIONS_ACCESS_GRANTS` parser; default remains deny.
- Results are explicitly selected, bounded to 100, with no email addresses, phone numbers, customer records or commercial write actions.
- An opt-in, **manual** public-search source adapter using SerpApi. It runs at most two fixed UK research searches per channel, 10 organic results per search, and returns suggestions clearly marked `unverified_search_result`.
- Tests with stubbed search results and mocked repository data. CI runs these without live credentials.

## Running discovery manually (nothing runs automatically)
1. Obtain an account and API key from your chosen research provider if you decide to use SerpApi. Check current pricing and terms before enabling.
2. Set `SERPAPI_API_KEY` **privately** on the operator's machine or a secret-controlled job. Never place it in the repository, GitHub workflow YAML, an issue or a screenshot.
3. Run:
   ```bash
   node tools/growth-agent/discover-cli.mjs creator
   node tools/growth-agent/discover-cli.mjs partner
   ```
4. Inspect public profile/company URLs and verify each candidate manually. Search snippets do not establish follower numbers, UK audience composition, business ownership or a right to send marketing.
5. Candidate lists are printed to stdout only. This milestone **does not ingest candidates into PostgreSQL**. A separate, security-reviewed ingestion PR is required before persistence.

## Protected read endpoint
- Requires a verified Cloudflare Access JWT and an operator whose `OPERATIONS_ACCESS_GRANTS` entry includes `growth:read`. Do not add any grants by default.
- Lists reviewed research rows already in the `growth.prospects` table; currently the production table is empty.
- HTTP `GET` only, including `Cache-Control: no-store`. Unauthorized users get 401/403.
- Example after separately approving an operator grant:
  ```text
  GET /operations/growth/prospects?channel=creator
  ```
- No public dashboard UI is included yet. The endpoint is intended for the subsequent private dashboard milestone.

## Security requirements before automation
- Dedicated restricted PostgreSQL credentials for any **future AI discovery writer**; do not give an agent the commerce API's owner connection or access to orders, payments, fulfilment or customer data.
- Use allowlisted discovery sources and reasonable request budgets, not mass harvesting.
- Apply lawful contact-route checks, UK GDPR/PECR safeguards, data minimisation, suppression handling and retention before any outreach.
- Keep all sending and publishing disabled. Nothing in this PR can contact prospects.

## Validation
```bash
node --test tools/growth-agent/discover.test.mjs tools/growth-agent/qualification.test.mjs
npm run check:commerce
npm run test:commerce
```

Review the PR's CI before merging. The production operations service automatically deploys on changes to main; although this route remains denied without an explicit grant, validate access behaviour after deployment. This PR does not add a new Render service, database, paid subscription, scheduled task, or runtime API key.
