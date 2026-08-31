# CYPH/1 Commerce Implementation Roadmap

**Status:** Implementation-ready planning baseline  
**Constraint:** No public checkout or production payment capability during pre-launch

## Outcome

Evolve the existing `cyph1.co.uk` Astro website into a commerce-capable storefront backed by a provider-neutral API, while keeping every commerce feature private or disabled until the launch gate is approved.

## Milestone 0 — decisions and launch inputs

### 0.1 Confirm the sellable proposition

- Approve the final product and SKU.
- Approve retail price, VAT treatment and landed economics.
- Verify claims, compliance and customer-facing specifications.
- Approve delivery, returns, warranty and support policies.

**Exit:** The product record can be populated without placeholders or unsupported claims.

### 0.2 Confirm operating model

- Confirm the legal entity and settlement account.
- Confirm stock ownership and fulfilment provider/process.
- Assign operational ownership for orders, refunds, disputes and incidents.
- Approve privacy, retention and accounting requirements.

**Exit:** Merchant onboarding and operational process design can proceed.

### 0.3 Validate payment providers

- Complete Mollie merchant and settlement validation.
- Validate Square account eligibility and bank compatibility.
- Recheck current fees and required payment methods.
- Record Stripe and Revolut Business decision triggers.

**Exit:** Mollie is approved for test implementation and Square remains a viable fallback.

## Milestone 1 — foundation behind feature flags

### 1.1 Create commerce workspace

- Introduce the agreed `apps/commerce-api` and `packages/commerce-core` boundaries.
- Add TypeScript strictness, formatting and test commands.
- Add non-secret environment templates.
- Ensure commerce is disabled by default.

**Acceptance:** Existing website builds unchanged; no public commerce route is enabled.

### 1.2 Create relational schema

- Add versioned migrations for products, inventory, customers, country-led shipping zones/rates, orders, order items, payments, refunds, webhook events and audit events.
- Add constraints, indexes and timestamps defined in the data-model document.
- Add seed data that is unmistakably non-production and inaccessible publicly.

**Acceptance:** A clean database can be created and migrated repeatedly; constraints reject invalid states.

### 1.3 Implement domain rules

- Money uses integer minor units and ISO currency codes.
- Add server-side basket calculation.
- Add server-side shipping eligibility and rate calculation with zone defaults and country overrides.
- Implement order and payment state machines.
- Add idempotent command handling and audit events.

**Acceptance:** Unit tests cover totals, shipping eligibility/overrides, invalid transitions, retries and duplicate commands.

## Milestone 2 — Mollie test-mode vertical slice

### 2.1 Implement payment boundary

- Implement the provider contract and registry.
- Add Mollie test adapter.
- Create checkout sessions using authoritative order totals.
- Store provider references without leaking provider types into the order domain.

### 2.2 Implement webhook processing

- Preserve raw request bodies.
- Verify provider authenticity.
- Deduplicate events and support out-of-order delivery.
- Update payment and order states transactionally.
- Trigger downstream actions exactly once.

### 2.3 Add private storefront flow

- Add an approved-product route behind a disabled feature flag.
- Add basket validation and checkout initiation.
- Add pending, success, cancellation and error states.
- Make the redirect page non-authoritative.

Implementation note: the route is generated only when the private presentation
flag and all test identifiers are present at build time. Normal builds contain
no commerce pages. The API has a separate server-side enablement gate, an exact
origin allowlist and durable PostgreSQL idempotency. Private test fixture values
are not approved product, price, tax, stock or fulfilment data.

**Acceptance:** Test-mode checkout completes end to end without changing the public site or creating live charges.

## Milestone 3 — fulfilment and operations

### 3.1 Fulfilment adapter

- Implement the approved 3PL/manual fulfilment boundary.
- Require verified payment before fulfilment.
- Handle acceptance, dispatch, tracking, cancellation and return states.

Implementation baseline completed:

- Provider-neutral contract with an explicitly non-production `manual-test` adapter.
- Disabled-by-default configuration; test adapter cannot run outside test mode.
- Verified `payment.paid` outbox events are the only automatic trigger, followed by
  a fresh database check for both `orders.status = 'paid'` and a captured payment.
- Durable request and provider-event idempotency, dispatch/tracking persistence,
  cancellation and return transitions, audit events and manual-review routing.
- No approved 3PL integration or production customer-data transfer has been added.

### 3.2 Operations interface

- Add protected order search and timelines.
- Add permission-controlled refund actions.
- Add manual review and safe retry tools.
- Add reconciliation export.

Implementation baseline completed:

- Runtime-neutral handler with a trusted identity-middleware principal boundary and separate least-privilege permissions.
- Protected order search/details, audit timelines, provider-authoritative idempotent refunds, failed paid-event retries and bounded reconciliation CSV.
- Durable operator-command and audit records, formula-safe exports without customer/address data, and a separately gated no-index console route.
- The console is omitted from ordinary builds and is not authentication; it must share a protected origin with the API behind verified upstream identity.

### 3.3 Transactional communication

- Add order confirmation, dispatch, cancellation and refund templates.
- Keep marketing consent independent of purchase messages.
- Prevent duplicate sends through idempotent events.

Implementation baseline completed:

- Provider-neutral order confirmation, dispatch, cancellation and refund templates with a disabled-by-default manual test adapter.
- Independent communication-delivery ledger over the transactional outbox, using semantic deduplication keys and bounded retries without competing with fulfilment processing.
- Purchase messages resolve the order customer directly and do not consult or modify marketing-consent records.
- Refund completion emits its communication event atomically with the refund, payment and order updates.

**Acceptance:** An operator can fulfil, refund and reconcile a test order without database editing.

## Milestone 4 — quality and launch readiness

### 4.1 Automated quality gates

- Enforce commerce tests, structural accessibility, link integrity and performance budgets in pull requests.
- Maintain a launch-readiness register that separates automated evidence from manual and accountable approvals.
- Keep production commerce disabled while any launch gate is outstanding.

Implementation baseline completed:

- The GitHub quality workflow now runs strict project checks, commerce tests, the public build, structural accessibility, performance-budget and generated-link audits.
- `docs/operations/COMMERCE-LAUNCH-READINESS.md` records current evidence and all outstanding engineering, security, legal, financial and operational gates without treating CI as launch approval.

### 4.2 Provider failure and ambiguous-checkout resilience

- Bound provider requests with an explicit timeout and safe retry classification.
- Preserve ambiguous checkout attempts for reconciliation rather than cancelling an order that may have a provider-side payment.
- Block duplicate attempts through the existing idempotency boundary.
- Document the provider-outage, investigation and recovery procedure.

Implementation baseline completed:

- Retryable provider failures move the checkout session to `resolution_required`; definitive failures still abandon the draft order.
- Mollie test requests have a bounded timeout and expose only a safe retryable network category.
- Automated tests cover both ambiguous and definitive failure paths without live provider calls.
- `docs/operations/PAYMENT-PROVIDER-OUTAGE.md` defines fail-closed reconciliation and recovery.

### 4.3 Refund, cancellation, return and dispute resilience

- Exercise partial and full refunds with explicit amounts and idempotency.
- Preserve ambiguous refund requests for provider reconciliation and continue reserving their value.
- Enforce the pre-dispatch cancellation and post-dispatch return boundaries.
- Reject unsafe out-of-order dispute transitions for manual review.

Implementation baseline completed:

- Retryable refund failures enter `resolution_required` rather than becoming eligible for an unsafe replacement refund.
- Automated tests cover partial/full refund requests, stable fulfilment command keys and ordered/duplicate/out-of-order disputes.
- `docs/operations/REFUNDS-RETURNS-AND-DISPUTES.md` defines the sandbox exercise and reconciliation procedure.

### 4.4 Threat model, secrets and access baseline

- Document commerce assets, trust boundaries, threats, controls and residual launch actions.
- Reject secret-like browser environment names at runtime and audit tracked source in CI.
- Validate trusted operator principals before applying least-privilege permissions.
- Provide an accountable deployment secret and account-access review worksheet.

Implementation baseline completed:

- `docs/architecture/COMMERCE-THREAT-MODEL.md` records the dated engineering threat model.
- Commerce configuration rejects secret-like `PUBLIC_` variables and CI runs `npm run audit:commerce-security`.
- Operations endpoints reject malformed principals and return restrictive response headers.
- `docs/operations/COMMERCE-ACCESS-AND-SECRETS-REVIEW.md` keeps real account, MFA, role and rotation review explicitly outstanding for accountable completion.

### 4.5 Private interface accessibility baseline

- Test the generated private checkout, status and operations routes for structural accessibility.
- Keep forms usable at narrow mobile widths without input zoom or horizontal overflow.
- Announce asynchronous results and move focus when errors or hidden order details are revealed.
- Preserve keyboard focus styling, reduced-motion behaviour and non-indexable private routes.

Implementation baseline completed:

- Private controls use explicit constraints, mobile-safe sizing and responsive layouts.
- Checkout and operations status changes use live regions; failed checkout and revealed order details receive programmatic focus.
- CI builds an isolated private fixture and audits landmarks, labels, numeric constraints, status announcements, indexing directives and mobile-source safeguards.
- Manual keyboard, screen-reader, 200%/400% zoom, mobile-device and reduced-motion checks remain an accountable launch-readiness action; automated structure does not constitute manual sign-off.

### 4.6 Protected staging identity boundary

- Add a dedicated operations-only Node staging listener with generic health and database readiness checks.
- Verify Cloudflare Access JWT signature, issuer and exact application audience before constructing an operator principal.
- Map a verified email to least-privilege permissions using server-side configuration only.
- Keep checkout, webhooks, live payments and the public site outside this runtime.

Implementation baseline completed:

- The staging listener exposes `/operations/*` only and limits request bodies; unknown routes return `404`.
- Cloudflare Access assertions use remote JWKS and RS256 verification. Missing, invalid and ungranted identities fail closed.
- Forged browser permission headers cannot affect the server-side grant map.
- Render and Cloudflare setup, MFA/account ownership and an independent role review remain accountable manual work.

### 4.7 Staging observability and incident response

- Emit privacy-safe structured logs with server-generated request correlation.
- Keep route labels bounded and exclude identities, IPs, assertions, bodies, query strings and order references.
- Document Render health monitoring, Cloudflare Access review and fail-closed incident recovery.
- Preserve manual ownership of provider alerts, retention and production service objectives.

Implementation baseline completed:

- The operations listener emits one JSON event per request and returns the same correlation value in `X-Request-ID`.
- Automated tests verify bounded route classification and the absence of path, query, identity and secret-like values from log entries.
- `docs/operations/COMMERCE-STAGING-OBSERVABILITY.md` defines staging monitoring, severity classification, incident handling and recovery verification without weakening Access.

### 4.8 Automated staging monitor and recovery drill

- Check the generic Render liveness and database-readiness responses on a
  schedule without bypassing Cloudflare Access.
- Keep the Render origin in GitHub Actions secrets and exclude it from monitor
  output.
- Use native Actions failure notifications for staging alerts.
- Exercise a reversible Render-service suspension and recovery without touching
  production, payments, Access policy or database data.

Implementation baseline completed:

- A scheduled and manually dispatchable workflow checks exact `/health` and
  `/ready` responses with bounded timeouts.
- Unit tests cover origin validation, successful checks and fail-closed
  responses.
- The repository secret was configured and the monitor produced a successful
  healthy baseline in GitHub Actions.
- A controlled Render suspension produced the expected failed monitor runs;
  after an operator-assisted Render restart, the recovery run passed.
- The staging runbook records the drill evidence and the manual-restart
  recovery characteristic. Production alert ownership and service objectives
  remain launch-gate decisions.

### 4.9 Staging incident ownership and alert routing

- Assign accountability for monitor acknowledgement, Render recovery,
  Cloudflare Access review and database verification.
- Document primary signal routes and a privacy-safe escalation procedure.
- Keep personal contact details in a private register rather than source
  control.
- Treat backup ownership, production on-call coverage and service objectives as
  launch gates.

Implementation baseline completed:

- `docs/operations/COMMERCE-INCIDENT-OWNERSHIP.md` assigns the current staging
  responsibilities to the project-owner role and records that no independent
  backup exists yet.
- GitHub Actions, Render, Cloudflare Access and database-readiness signals have
  explicit response actions and fail-closed escalation rules.
- A manual checklist preserves provider notification verification and
  production staffing as accountable work rather than asserting completion.

- Test keyboard, screen-reader, mobile and reduced-motion behaviour.
- Test provider failures, timeouts, duplicate/out-of-order webhooks and abandoned checkout.
- Test full and partial refunds, cancellations, returns and disputes.
- Complete threat modelling, secret review and access review.
- Run performance and resilience tests.
- Complete legal, privacy, tax, accounting and PCI reviews.
- Create incident, reconciliation and provider-outage runbooks.

**Exit:** Every item in the architecture launch gate is signed off.

## Milestone 5 — controlled production launch

- Enable production configuration without exposing it to previews.
- Run a controlled internal live-payment/refund test.
- Release commerce behind a reversible production flag.
- Manually monitor early orders and daily reconciliation.
- Keep early-access records and purchase consent purposes distinct.

## Milestone 6 — resilience and optimisation

- Implement Square only when fallback resilience is operationally justified.
- Exercise provider-switch procedures in staging.
- Evaluate Stripe for international or advanced needs.
- Evaluate Revolut Business or another provider using actual volume and cost data.
- Add customer accounts, subscriptions or new markets only through separate approved proposals.

## Suggested GitHub issues

1. Scaffold commerce workspace and disabled feature flags.
2. Implement relational schema and migrations.
3. Implement money, basket and order domain rules.
4. Implement payment-provider contract and provider registry.
5. Implement Mollie test adapter.
6. Implement secure, idempotent webhook pipeline.
7. Build private end-to-end test checkout.
8. Implement fulfilment boundary.
9. Build protected operations workflow.
10. Implement transactional order email events.
11. Add reconciliation and operational alerts.
12. Complete commerce security, accessibility and resilience audit.

Each issue should be independently reviewable and must preserve the public pre-launch experience until launch approval.
