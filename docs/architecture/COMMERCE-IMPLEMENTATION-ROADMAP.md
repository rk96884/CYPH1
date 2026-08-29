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

**Acceptance:** Test-mode checkout completes end to end without changing the public site or creating live charges.

## Milestone 3 — fulfilment and operations

### 3.1 Fulfilment adapter

- Implement the approved 3PL/manual fulfilment boundary.
- Require verified payment before fulfilment.
- Handle acceptance, dispatch, tracking, cancellation and return states.

### 3.2 Operations interface

- Add protected order search and timelines.
- Add permission-controlled refund actions.
- Add manual review and safe retry tools.
- Add reconciliation export.

### 3.3 Transactional communication

- Add order confirmation, dispatch, cancellation and refund templates.
- Keep marketing consent independent of purchase messages.
- Prevent duplicate sends through idempotent events.

**Acceptance:** An operator can fulfil, refund and reconcile a test order without database editing.

## Milestone 4 — quality and launch readiness

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
