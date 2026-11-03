# CYPH/1 Growth Intelligence — branded dashboard

## User experience
A private, responsive, CYPH/1-branded Growth Intelligence console under the **existing private operations slug**, at:

`/private-operations/<configured-operations-slug>/growth/`

It inherits the brand's dark obsidian/plum palette, signal-lavender accent, typography and official BrandMark, and adds a link from the private operations console. It is **not** linked from the public website.

### Scope
- Reads live data from `GET /operations/growth/prospects`, subject to existing Cloudflare Access JWT validation and the explicit `growth:read` permission.
- Renders up to 100 records (API's current limit) with creator/partner count, pending-review count, prospect scores, confidence and evidence counts.
- Includes local channel/status/name filters, reload, detail panel and source links.
- Supports no-records, loading, permission-denied and API-error states.
- **Read-only**: no writes, approving, outreach, publishing, discovery jobs or database imports. No fake prospect records or sample KPIs.

## Deployment and access
This is an Astro static presentation, **not an authentication boundary**. It follows the existing operations UI's build flag and slug. When `privateOperationsPresentation()` returns no configuration, the page does not build. When enabled, the HTML is potentially obtainable by anyone with the static route URL; only the operations API is protected by cryptographically validated Cloudflare Access assertions.

Before using the dashboard:
1. Confirm the operations UI environment configuration points at the intended HTTPS operations API and is deployed only in the approved hosting context.
2. Protect the static dashboard's hostname/path using Cloudflare Access if confidentiality of the UI itself matters; a hidden URL and noindex are **not** access controls.
3. Assign `growth:read` explicitly to an approved operator in the **server-side** `OPERATIONS_ACCESS_GRANTS` environment variable. This is not changed by the PR. Existing commerce permissions need not change.
4. Confirm unauthenticated requests return 401, other roles return 403, and approved accounts see live records or the true empty state.
5. Until approved research ingestion is built, the six production Growth tables remain empty and the dashboard correctly reports zero prospects.

## Testing
```sh
node --test scripts/test-growth-dashboard.mjs
npm run check
npm run build
```

To render locally, use the same optional private operations environment values as the existing console, pointing at an approved development API. The endpoint will still demand valid auth; a local static page is not a bypass.

## Follow-up milestone
Build an allowlisted, compliant, approved research-ingestion workflow, with an isolated least-privilege database role. A subsequent review UI can add approval/audit actions only after roles, legal contact routes, retention and suppression handling have been explicitly designed.
