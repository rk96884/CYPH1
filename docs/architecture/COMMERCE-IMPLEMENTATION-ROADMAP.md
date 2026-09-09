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
- `docs/accessibility/PRIVATE-COMMERCE-MANUAL-REVIEW.md` defines the exact isolated fixture, route matrix, assistive-technology checks, pass criteria and evidence record.
- Local keyboard, NVDA screen-reader, 200%/400% zoom, responsive-reflow,
  reduced-motion and forced-colours checks passed on 7 September 2026 after
  remediation. Native operating-system settings, a physical-device smoke test
  and production assistive-technology checks remain accountable launch actions;
  automated structure does not constitute final launch sign-off.

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

### 4.10 Controlled commerce disable and rollback baseline

- Separate customer checkout containment from webhook, reconciliation and
  protected-operations recovery.
- Document the existing build-time presentation and server-side commerce gates.
- Require source-controlled application reverts and prohibit ad-hoc database
  reversal or record deletion.
- Define recovery verification and privacy-safe evidence requirements.

Implementation baseline completed:

- `docs/operations/COMMERCE-DISABLE-AND-ROLLBACK.md` defines the containment,
  source rollback, data-safety and re-enable sequence using existing controls.
- The procedure records that the current Render operations listener is not a
  checkout kill switch and must not be suspended for an unrelated checkout
  incident.
- Independent checkout and webhook gating in the eventual customer runtime,
  plus a controlled staging rehearsal, remain launch gates.

### 4.11 Customer commerce runtime safety boundary

- Introduce a customer-facing runtime that is deployed independently from the
  Cloudflare Access-protected operations service.
- Keep checkout initiation and payment-webhook ingestion behind separate,
  strict server-side route-exposure controls.
- Preserve the existing `COMMERCE_ENABLED` dependency gate beneath checkout
  exposure so a presentation or routing change cannot enable commerce alone.
- Expose only generic health/readiness responses and bounded request bodies;
  do not expose operations routes or diagnostic detail.
- Document staging configuration, containment and evidence requirements before
  the runtime can be deployed.

Implementation baseline completed:

- `customer-server.ts` composes the existing checkout and verified Mollie
  webhook pipelines behind independent `CHECKOUT_HTTP_ENABLED` and
  `PAYMENT_WEBHOOKS_ENABLED` controls, both disabled by default.
- The checkout path remains independently subject to `COMMERCE_ENABLED` and
  the configured payment/fulfilment dependencies.
- Customer runtime and raw-webhook handler tests cover default denial,
  independent exposure, generic readiness failure, body limits and safe
  provider-failure responses.
- A read-only staging verifier checks the disabled, active and checkout-contained
  route states without creating a checkout or submitting a webhook.
- `docs/operations/COMMERCE-CUSTOMER-RUNTIME.md` records the deployment and
  containment contract. A protected staging deployment and controlled
  checkout-disable/webhook-continuity rehearsal remain outstanding.

### 4.12 Payment-provider outage and ambiguous-payment handling

- Separate definitive rejection from an outcome that may have succeeded at the
  provider.
- Contain new checkout without interrupting verified webhooks for in-flight
  payments.
- Prevent replacement payment/refund attempts until the original provider state
  is authoritative and reconciled.
- Define privacy-safe evidence, recovery checks and re-enable ownership.

Implementation baseline completed:

- `docs/operations/PAYMENT-PROVIDER-OUTAGE.md` maps existing checkout, webhook
  and refund failure states to explicit operator decisions and escalation.
- The procedure preserves `resolution_required` records, provider idempotency
  evidence and immutable payment/audit history; ad-hoc database resolution is
  prohibited.
- Checkout containment retains independently gated verified webhook processing,
  followed by a bounded reconciliation window and deliberate re-enable step.
- A Mollie sandbox timeout, webhook-continuity and ambiguous-refund exercise
  remains outstanding until the reviewed test organisation/key are available.

### 4.13 Daily payment, order and refund reconciliation

- Compare every provider payment/refund with local order and payment state.
- Surface ambiguous checkouts/refunds and multiple payment attempts explicitly.
- Keep customer identity, addresses and payment credentials out of the export.
- Define exception ownership, close criteria and privacy-safe evidence.

Implementation baseline completed:

- The protected reconciliation CSV now returns every payment attempt, retains
  orders without a payment, and includes activity on older orders when a payment
  or refund was created in the selected interval.
- Checkout state plus completed, open, ambiguous and failed refund totals are
  exported explicitly without customer/address fields.
- `docs/operations/DAILY-PAYMENT-RECONCILIATION.md` defines UTC intervals,
  provider matching, exception classes, clean-close criteria and evidence.
- Mollie sandbox balancing, finance approval, production schedule and independent
  review remain launch gates.

### 4.14 Fulfilment outage and manual-review processing

- Stop unbounded automatic provider retries while retaining a controlled,
  permission-gated recovery path.
- Distinguish definite provider absence from an ambiguous creation outcome.
- Route unsafe fulfilment transitions and state mismatches to manual review.
- Preserve payment/webhook reconciliation during a fulfilment-only outage.

Implementation baseline completed:

- Failed fulfilment outbox events now stop automatic processing after three
  attempts; an explicit `fulfilment:retry` operation can requeue one event after
  provider reconciliation.
- Stable provider idempotency, paid/captured revalidation and existing event
  identity/state-machine controls remain in force for every retry.
- `docs/operations/FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md` defines containment,
  exception classes, retry evidence, state mismatch, recovery and privacy-safe
  records.
- Provider selection, provider-specific security/privacy review and sandbox
  outage exercise remain launch gates.

### 4.15 Personal-data incident escalation

- Define a controller-awareness clock, immediate containment and evidence
  preservation procedure for suspected personal-data breaches.
- Assess likelihood and severity of risk to people and route the notification
  decision to an authorised privacy/legal owner.
- Preserve a restricted breach register while keeping identities, secrets and
  raw incident evidence out of source control.
- Define recovery, processor escalation, closure and a synthetic exercise.

Implementation baseline completed:

- `docs/operations/PERSONAL-DATA-INCIDENT-ESCALATION.md` maps the current data
  and processor surface to containment, assessment, notification and recovery.
- The procedure records the current ICO likely-risk, high-risk and 72-hour
  baselines while requiring the accountable owner to verify current guidance.
- Every confirmed breach must be documented, including a justified decision not
  to report; source-controlled evidence remains privacy-minimised.
- Legal/privacy approval, named primary and backup owners, processor contacts,
  communication templates and a synthetic tabletop exercise remain launch
  gates.

### 4.16 Database backup and restore rehearsal

- Create a logical backup without changing or locking the staging application.
- Restore only into a separately named empty database and prohibit destructive
  restore flags against useful data.
- Compare migration history and aggregate row counts without reading personal
  data, then run the transactional schema verifier.
- Record privacy-safe recovery evidence and clean up the temporary copy.

Implementation baseline completed:

- `docs/operations/DATABASE-BACKUP-AND-RESTORE-REHEARSAL.md` documents the Free
  Postgres limitations, guarded backup/restore steps and production paid-plan
  gates.
- `db:verify:restore` rejects an unguarded, same-database or incorrectly named
  target and compares 23 table counts plus immutable migration checksums in
  read-only repeatable-read transactions.
- The workstation currently lacks PostgreSQL client tools and the Render Free
  plan cannot create managed backups or a second Free target; the first local
  isolated restore therefore remains a manual milestone step.
- Paid Render PITR, encrypted off-platform scheduling and a missing-backup alert
  remain production launch gates.

### 4.17 Dependency and runtime supply-chain security

- Enforce severity thresholds for production and build dependencies in CI.
- Monitor npm packages and GitHub Actions for reviewed updates without
  auto-merging commerce changes.
- Define vulnerability triage, time-bounded exceptions and rollback handling.
- Preserve an accountable deployed-runtime and platform review as a launch gate.

Implementation baseline completed:

- The quality workflow now runs locked installation followed by production and
  complete-tree npm vulnerability thresholds before building.
- Dependabot checks npm and GitHub Actions weekly and keeps major updates
  separate from grouped minor/patch changes.
- `docs/operations/DEPENDENCY-AND-RUNTIME-SECURITY.md` defines review,
  vulnerability response, exceptions and platform evidence.
- The first production audit passed on 7 September 2026. Four unfixed
  `fast-uri` advisories in the development-only Astro language-server chain are
  covered by an exact, fail-closed exception expiring 8 October 2026.
- First update review, removal of the temporary exception, deployed
  Render/PostgreSQL review and production ownership remain launch gates.

### 4.18 Checkout abuse and rate-limit protection

- Bound concurrent and rolling-window checkout initiation without applying the
  limit to payment webhooks, health/readiness or protected operations.
- Reject missing or unsafe configuration at startup and return a generic,
  retryable saturation response before database/provider work.
- Avoid trusting forwarded client-IP headers or storing a new customer
  identifier solely for rate limiting.
- Define the Cloudflare edge, direct-origin and bounded staging-test gates.

Implementation baseline completed:

- The customer runtime now requires explicit admission limits whenever checkout
  routing is enabled and applies them to `POST /checkout` only.
- Unit tests cover configuration bounds, rolling-window recovery, concurrent
  saturation, CORS, non-POST requests and capacity release after failure.
- `docs/operations/CHECKOUT-ABUSE-AND-RATE-LIMITING.md` documents the layered
  boundary, limitations, monitoring and controlled synthetic exercise.
- Cloudflare policy configuration, direct-origin restriction, capacity-based
  thresholds, provider-safe load evidence and production alert ownership remain
  launch gates.

### 4.19 Read-only staging performance and resilience probe

- Provide a bounded load signal without creating orders or contacting commerce
  providers.
- Enforce exact health/readiness responses, timeouts, concurrency and request
  ceilings, and an explicit synthetic-run confirmation.
- Record percentile latency and failures without logging response bodies or
  identifiers.
- Preserve separately approved checkout, webhook and provider exercises as
  launch gates.

Implementation baseline completed:

- `scripts/check-commerce-staging-load.mjs` performs 2–200 alternating read-only
  health/readiness requests with no more than ten concurrent requests.
- The probe fails on any unexpected response and on an explicit p95 threshold;
  its configuration and runner have deterministic unit coverage in CI.
- `docs/operations/COMMERCE-PERFORMANCE-AND-RESILIENCE.md` defines the controlled
  staging procedure, acceptance criteria, evidence fields and deferred work.
- The first read-only staging run passed on 7 September 2026: 40 requests at
  concurrency 4 produced zero invalid responses, p50 63 ms, p95 198 ms and a
  240 ms maximum against a 2,000 ms p95 threshold. Commerce staging monitor run
  #50 passed immediately afterwards against `c90ac74`.
- Checkout-specific burst and webhook-continuity exercises, longer soak tests,
  provider resource evidence and production capacity approval remain
  outstanding.

### 4.20 Database interruption and runtime recovery baseline

- Fail dependency readiness closed without disclosing database diagnostics.
- Keep process liveness independent from database readiness.
- Recheck the dependency on every readiness request so recovery does not depend
  on cached failure state.
- Define a reversible managed staging exercise without risking the current
  development database.

Implementation baseline completed:

- Customer and operations runtime tests cover healthy, interrupted and recovered
  readiness while liveness remains available.
- Both runtimes already issue a fresh PostgreSQL readiness query per request and
  return only generic `ready` or `unavailable` states.
- `docs/operations/DATABASE-INTERRUPTION-AND-RUNTIME-RECOVERY.md` records the
  expected transitions, stop conditions, recovery validation and evidence
  fields.
- PostgreSQL driver/network recovery, alert delivery, schema/invariant checks
  and restart-free recovery against an isolated managed database remain
  deferred until a suitable paid staging target is approved.

### 4.21 Worker restart and retry-exhaustion resilience

- Lease durable fulfilment and communication claims so a worker crash cannot
  leave work permanently processing.
- Reclaim expired work only below a bounded automatic retry ceiling.
- Move exhausted claims to an explicit terminal failure for manual review.
- Preserve stable provider idempotency keys across recovery.

Implementation baseline completed:

- Migration `0010_worker_claim_leases.sql` adds claim timestamps and safely
  releases legacy processing rows for recovery.
- Fulfilment and communication claims use a bounded five-minute default lease
  and three-attempt default; invalid limits fail at construction.
- Expired final-attempt claims become `retry_exhausted`, while successful and
  failed completions clear their lease timestamps.
- `docs/operations/WORKER-RESTART-AND-RETRY-EXHAUSTION.md` defines migration,
  verification, managed rehearsal and provider-idempotency gates.
- Migration `0010` was applied idempotently and schema-verified on Render
  development PostgreSQL on 8 September 2026.
- A timed synthetic worker restart/exhaustion rehearsal, provider idempotency
  evidence and terminal-failure alert ownership remain outstanding.

### 4.22 Privacy-safe logging and reconciliation exports

- Keep operational request logs on an exact metadata allowlist and prevent
  paths, queries, identities, payloads and credentials entering diagnostics.
- Keep reconciliation output on an explicit ordered column allowlist rather
  than exporting arbitrary repository or database fields.
- Test prohibited personal, Access, credential and provider-payload canaries.
- Document secure handling and the deployed privacy decisions that remain
  launch gates.

Implementation baseline completed:

- Runtime logging tests now assert the exact structured field set as well as
  bounded routes and prohibited-value omission.
- The reconciliation column contract is exported as an immutable allowlist;
  tests assert its exact header and ignore injected customer, address, Access,
  credential and provider-payload fields.
- `docs/operations/LOGGING-AND-EXPORT-DATA-BOUNDARIES.md` records purposes,
  exclusions, handling rules and escalation.
- Render/Cloudflare access, processor geography, retention, deletion, privacy
  documentation and production approval remain accountable launch gates.

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
