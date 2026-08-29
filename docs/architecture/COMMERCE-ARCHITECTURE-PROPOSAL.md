# CYPH/1 Commerce Architecture Proposal

**Status:** Baseline proposal — approved direction, not yet authorised for implementation  
**Market:** United Kingdom initially  
**Last updated:** 29 August 2026

## 1. Purpose and boundary

This document defines how the existing CYPH/1 website will evolve into the future e-commerce website. CYPH/1 will retain one customer-facing website and primary domain, `cyph1.co.uk`; a separate public store is not proposed. The current Astro experience becomes the storefront by progressively adding approved product, basket, checkout and order-status capabilities.

The architecture establishes a provider-neutral foundation supporting Mollie initially, Square as the practical fallback, Stripe when broader capabilities justify it, and Revolut Business or another provider if future revenue, pricing and technical suitability support a change.

This is an architectural proposal only. The current website remains a pre-launch brand and early-access experience. Checkout, payments and pre-orders must not be enabled until the launch-readiness conditions in the project brief have been satisfied.

## 2. Principles

The commerce platform should:

- keep CYPH/1 product, customer and order data independent of any payment provider;
- use hosted checkout or provider-rendered fields so card data never passes through CYPH/1 systems;
- start with one product and one UK market without preventing later expansion;
- favour a reliable modular monolith over premature microservices;
- validate prices, stock, promotions and totals on the server;
- treat verified payment webhooks as authoritative;
- support safe retries and prevent duplicate orders or charges;
- separate payments from fulfilment, email and analytics;
- minimise personal-data collection and retention;
- remain accessible, mobile-first and progressively enhanced;
- avoid dependence on a particular OEM, 3PL or commerce platform.

## 3. Recommended system shape

Use a statically rendered Astro storefront supported by a small server-side commerce API and relational database.

```text
Customer browser
       |
       v
Astro storefront
       |
       v
Commerce API / backend-for-frontend
       |
       +--> Catalogue and pricing
       +--> Order service ----------> Relational database
       +--> Payment adapter --------> Mollie / Square / Stripe / future provider
       +--> Fulfilment adapter -----> Approved fulfilment provider
       +--> Transactional email ---> Approved email provider
       +--> Analytics events -------> Consent-aware analytics

Payment-provider webhooks ----------> Verified webhook endpoint
                                             |
                                             v
                                    Order state transitions
```

The backend should initially remain one deployable application with clearly separated modules. Services should be split only when scale, reliability or ownership creates a genuine need.

## 4. Storefront

Astro should remain the presentation layer unless later requirements reveal a material limitation. This is an evolution of the existing website, not a replacement storefront. Existing brand, science, legal and early-access content should remain part of the same coherent experience while approved commerce routes and components are added progressively.

The storefront should provide approved product information, configurable pricing and availability, basket and checkout initiation, order confirmation/status pages, legal information, accessible forms, server-rendered metadata and minimal client-side JavaScript.

The browser must never provide an authoritative price, discount, tax, delivery charge or stock state. It may submit product and quantity selections; the commerce API calculates and validates the final total.

Shipping eligibility is resolved by ISO destination country. Countries map to reusable zones for default pricing, while explicit country overrides handle exceptional rates or restrictions. A missing active country/method rate is an unsupported destination, never permission to apply a generic global fallback. The selected method and calculation inputs are snapshotted on the order so later rate changes do not alter its history.

## 5. Commerce API

The API is the boundary between the website and operational systems. It should:

- return the current purchasable catalogue;
- validate baskets and calculate price, tax, promotions and delivery;
- select eligible shipping methods using destination country, packaged weight, order value and effective-dated rates;
- reserve stock where required;
- create an internal order before payment begins;
- select and invoke the configured payment adapter;
- receive and validate payment webhooks;
- transition order and payment states;
- trigger email and fulfilment only after verified payment;
- support controlled cancellation and refund workflows.

Public endpoints must be narrowly scoped, schema-validated, rate-limited and protected against automated abuse where appropriate.

## 6. Payment-provider abstraction

Payment logic should live behind a small provider interface rather than being distributed through the storefront and order code.

```text
createCheckout(order, returnUrls)
getPaymentStatus(providerPaymentId)
refundPayment(providerPaymentId, amount, reason)
verifyWebhook(rawBody, headers)
normaliseWebhook(event)
```

Suggested normalised events are:

- `payment.pending`
- `payment.authorised`
- `payment.paid`
- `payment.failed`
- `payment.cancelled`
- `payment.expired`
- `refund.pending`
- `refund.completed`
- `refund.failed`
- `dispute.opened`
- `dispute.updated`

Provider-specific payloads should be retained only where operationally necessary, excluding secrets and unnecessary personal data from logs.

## 7. Provider strategy

### Mollie — primary launch candidate

Mollie is the preferred initial provider, subject to successful merchant approval and final commercial verification. It currently offers the strongest fit for a UK-first launch through hosted checkout, APIs, webhooks, test mode, wallets and competitive domestic-card pricing.

Use hosted checkout initially unless an approved customer-experience requirement justifies embedded fields. This reduces PCI scope and implementation risk.

### Square — practical fallback

Square is the first fallback candidate. It meets the baseline requirements through hosted checkout, payment and refund APIs, signed webhooks, idempotency, sandbox testing and wallet support. Its physical point-of-sale ecosystem may also help if CYPH/1 later sells at events or pop-ups.

Account approval, settlement-bank compatibility, current pricing and required payment methods must be revalidated before implementation.

### Stripe — strategic alternative

Stripe remains an approved strategic option rather than the immediate fallback. It becomes particularly valuable for broader international coverage, subscriptions, marketplace payments, extensive payment-method support or integrations. A Stripe adapter should be possible without changing the storefront, order model or fulfilment integration.

### Revolut Business or another future provider

Revolut Business, or another regulated provider, may be evaluated when revenue, eligibility and commercial terms justify it. Business banking use alone is not a reason to integrate its payment product.

Every future provider must pass the same acceptance criteria:

- availability to the CYPH/1 legal entity and UK business model;
- proper online merchant acquiring, not manual-only payment links;
- documented production and test APIs;
- hosted checkout or PCI-compliant embedded fields;
- signed, retryable webhooks;
- idempotent payment and refund operations;
- required wallets and payment methods;
- full and partial refunds;
- dispute and chargeback visibility;
- exportable reconciliation data;
- acceptable settlement, reserves, support and account-risk processes;
- acceptable security, privacy, regulatory terms and total cost.

Selection should consider approval status, average order value, card mix, refunds, chargebacks and monthly volume—not headline rates alone.

## 8. Checkout flow

1. The customer selects a product and quantity.
2. The storefront submits identifiers, quantity and delivery information.
3. The API retrieves authoritative product, price and stock data.
4. It calculates the total and creates an internal order with an idempotency key.
5. The adapter creates a hosted checkout session.
6. The customer pays on the provider-hosted page.
7. The provider redirects to a CYPH/1 confirmation or pending page.
8. That page displays a non-authoritative status while the backend checks the order.
9. A signed provider webhook updates the authoritative payment state.
10. A paid order triggers confirmation and fulfilment exactly once.

A browser redirect must never mark an order paid by itself.

## 9. Core data model

### Product and inventory

- Internal product ID, SKU, approved copy and publication status.
- Price, currency and tax classification.
- Approved fulfilment attributes and fulfilment SKU.
- Available, reserved and safety-stock quantities by location.

### Customer

- Internal customer ID.
- Email and contact/delivery details necessary for the order.
- Marketing consent stored separately from the purchase.
- Privacy and retention metadata.

Customers must be able to purchase without marketing consent.

### Order

- Immutable CYPH/1 order reference.
- Customer and delivery snapshot.
- Line-item and price snapshots.
- Subtotal, discount, tax, delivery, total and currency.
- Shipping destination, selected method and immutable rate-calculation snapshot.
- Order and fulfilment states, timestamps and audit trail.

### Payment, refund and dispute

- Internal and provider IDs.
- Order and merchant-account references.
- Provider, amount, currency, normalised status and idempotency key.
- Refund/dispute amount, reason, state, references and audit timestamps.

Historical order snapshots must not change when the catalogue is edited later.

## 10. State management

Order and payment states remain separate. A suitable initial lifecycle is:

```text
draft -> awaiting_payment -> paid -> fulfilment_pending -> fulfilled
                       |          |             |
                       v          v             v
               payment_failed  cancelled    returned
                                  |
                                  v
                               refunded
```

Transitions must be explicit, auditable and repeat-safe. Duplicate or out-of-order webhooks must not cause duplicate emails, inventory deductions or fulfilment requests.

## 11. Webhooks and reliability

Each provider should have a dedicated webhook route or adapter entry point. The system must:

- validate signatures against the unmodified request body;
- reject invalid signatures and acknowledge valid events quickly;
- store provider event IDs for deduplication;
- handle repeat and out-of-order events;
- queue longer work where appropriate;
- retry transient failures and surface terminal failures;
- reconcile unsettled orders against provider records on a schedule.

Order creation, payment creation, refunds and fulfilment commands require idempotency keys.

## 12. Fulfilment boundary

The system must not assume manufacturer dropshipping or a particular 3PL. A fulfilment adapter should create requests only for verified paid orders, transmit only required data, receive dispatch/tracking updates, support pre-dispatch cancellation and returns, and preserve the CYPH/1 order reference.

Controlled manual fulfilment may be acceptable at very low volume if documented, access-controlled and auditable.

## 13. Administration

The initial administrative interface should support:

- order search and payment/fulfilment timelines;
- safe action retries;
- permission-controlled full and partial refunds;
- return and cancellation reasons;
- reconciliation exports;
- role-based access and an immutable audit trail.

Direct database editing must not be a normal operating procedure.

## 14. Security, privacy and compliance

- Keep raw card data within the provider's PCI-compliant interface.
- Store credentials in secret management, never the repository or browser.
- Separate test and production credentials, data and endpoints.
- Apply least privilege and multi-factor authentication.
- Encrypt data in transit and at rest.
- Validate all server-side input and minimise personal data in logs.
- Document retention, deletion and data-subject procedures.
- Review PCI responsibilities, UK GDPR, consumer law, tax and accounting before launch.

Legal and compliance wording requires suitably qualified professional review.

## 15. Environments and deployment

Maintain local, preview/staging and production environments. Each uses its corresponding provider mode, database and secrets. Preview deployments must never create real charges, fulfilment requests or customer emails without an explicit safe test configuration.

Database migrations must be versioned and deployments must support rollback without corrupting payment or order state.

## 16. Monitoring and reconciliation

Monitor checkout creation, webhook validation, payment/fulfilment mismatches, refund failures, provider latency/error rates and unusual payment-failure or dispute rates. Logs must be structured without exposing unnecessary personal data.

A scheduled reconciliation job should compare internal payments with provider records and report mismatches.

## 17. Delivery phases

### Phase 0 — pre-launch preparation

- Keep checkout disabled.
- Finalise product, pricing, fulfilment, compliance, warranty and returns.
- Validate Mollie approval and settlement.
- Validate Square as fallback.
- Finalise legal and retention requirements.

### Phase 1 — commerce foundation

- Add the relational schema and migrations.
- Build catalogue, basket validation and internal orders.
- Implement the payment interface and normalised events.
- Add Mollie test-mode hosted checkout and webhooks.
- Build confirmation, administration and reconciliation foundations.
- Test the chosen fulfilment workflow.

### Phase 2 — controlled launch

- Complete security, accessibility, performance and operational testing.
- Test payment, refund, failure, cancellation and duplicate-webhook scenarios.
- Enable checkout only after the launch gate is approved.
- Manually monitor early orders alongside automated reconciliation.

### Phase 3 — resilience and optimisation

- Implement Square if live payment redundancy is justified.
- Improve fulfilment and returns automation.
- Add customer accounts only if they provide clear value.
- Evaluate Stripe, Revolut Business or another provider using real data.
- Add markets only through an explicit readiness review.

## 18. Launch gate

No production payment capability should be enabled until these are approved:

- final product, sellable SKU, claims and compliance;
- retail price, tax and landed economics;
- stock ownership, fulfilment and delivery promise;
- returns, warranty and support processes;
- legal entity, merchant and settlement accounts;
- terms, privacy and required customer policies;
- payment, refund, cancellation and dispute procedures;
- security, accessibility and performance testing;
- accounting and reconciliation;
- production monitoring and incident ownership.

## 19. Decisions recorded

- Build a custom provider-neutral commerce layer, not a tightly coupled hosted platform by default.
- Retain Astro for presentation unless requirements justify change.
- Use a modular monolith and relational database initially.
- Prefer hosted checkout at launch.
- Treat signed webhooks, not redirects, as authoritative.
- Use Mollie as primary launch candidate.
- Use Square as practical fallback.
- Retain Stripe for international or advanced requirements.
- Consider Revolut Business or another provider only after equal technical and commercial assessment.
- Keep checkout disabled throughout pre-launch.

## 20. Open decisions

- Final product, SKU, retail price and claims.
- Legal entity and approved merchant accounts.
- Fulfilment model and provider.
- Runtime, hosting and relational database product.
- Tax, accounting, delivery and returns integrations.
- Guest-only checkout versus optional accounts.
- Promotions and early-access offers.
- Timing for a second live payment provider.
- International requirements.

These should be resolved from verified launch needs rather than hard-coded into the pre-launch site.
