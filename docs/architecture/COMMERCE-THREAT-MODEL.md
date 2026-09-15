# Commerce threat model

**Engineering baseline:** 30 August 2026; collection-point shipping extension 15 September 2026

**Scope:** Private/test commerce API, hosted checkout, PostgreSQL, payment and shipping-provider webhooks, fulfilment, communications and protected operations

**Production status:** Disabled and not approved

## Assets and security objectives

Protect order and contact data, provider and database credentials, authoritative prices and totals, payment/refund state, fulfilment commands, operator identity and the audit trail. Card data must remain on the hosted payment-provider surface; CYPH/1 must not collect or store it.

## Trust boundaries

1. **Public or private browser → commerce API:** Treat product identifiers, quantities, addresses, redirects and displayed status as untrusted. Recalculate totals server-side and enforce the server feature gate.
2. **Commerce API → payment provider:** Send only authoritative totals through the configured server-side adapter. Keep credentials server-only and use bounded requests and idempotency keys.
3. **Payment provider → webhook endpoint:** Accept raw provider input only at the approved endpoint. Authenticate its meaning through the provider before changing state; browser redirects are never authoritative.
4. **Commerce API → PostgreSQL:** Use parameterised queries, transactions and constraints. Keep the connection URL out of builds, logs and browser variables.
5. **Identity proxy → operations handler:** Only verified middleware may construct an operator principal. The handler validates its shape and applies an explicit least-privilege permission for every action.
6. **Commerce API → fulfilment and communications:** Both consumers remain disabled by default. Commands and deliveries use durable idempotency records and exclude marketing consent from transactional decisions.
7. **Source and CI → deployments:** Pull requests receive no commerce secrets. Preview, test and future production credentials and data must remain separate.
8. **Browser → collection-point search:** Treat postcode, coordinates and point identifiers as untrusted. Minimise search data, require an explicit action for browser geolocation and revalidate the chosen point on the server.
9. **Commerce API → shipping aggregator/carrier:** Send only the service-specific allowlist through a server-side adapter. Keep provider credentials and label access server-only and use bounded calls plus durable booking idempotency.
10. **Shipping provider → webhook endpoint:** Authenticate each event using the provider's approved signature or lookup mechanism, deduplicate it and map raw statuses through explicit domain transitions.

## Principal threats and controls

| Threat | Existing or required control | Residual action before launch |
| --- | --- | --- |
| Price, tax or shipping tampering | Server-side calculation, integer minor units, database snapshots and constraints | Exercise the final approved catalogue and tax rules |
| Duplicate checkout, refund or fulfilment | Durable idempotency keys and provider keys | Verify each live provider's documented behaviour |
| Ambiguous provider timeout | `resolution_required`, amount reservation and reconciliation runbooks | Exercise in provider sandbox |
| Forged or replayed webhook | Approved endpoint, provider-authenticated lookup, atomic event deduplication | Independent provider-specific review |
| Privilege escalation in operations | Trusted-principal boundary, runtime principal validation and per-action permissions | Configure identity proxy groups and independently review mappings |
| Secret exposed in browser or source | Runtime `PUBLIC_` rejection, CI repository audit, `.gitignore` and secret stores | Review actual deployment inventories and rotate any exposed value |
| Personal data in exports or logs | Bounded reconciliation fields, formula-safe CSV, safe provider errors and audit summaries | Retention/logging review and sampled deployment-log inspection |
| Test system creates live side effect | Test-only Mollie key enforcement; manual fulfilment/communication adapters; disabled defaults | Separate deployment accounts/credentials and keep production gate closed |
| Database compromise or data loss | Private connection, least privilege, migrations and audit records | Backup restore rehearsal, retention approval and database access review |
| Dependency or CI compromise | Locked dependencies and read-only quality-workflow token | Dependency review and protected-branch/ruleset review |
| Denial of service or abusive checkout | Explicit per-process checkout admission, bounded bodies, idempotency and fail-closed provider handling | Configure Cloudflare checkout-only policy, prevent direct-origin bypass and obtain load/soak evidence before public checkout |
| Collection-point substitution or stale selection | Server-side point/service validation, provider-namespaced identifier and immutable order snapshot | Exercise changed, removed, full and incompatible points |
| Customer location history retained through point search | Postcode alternative, explicit browser permission, transient coordinates and no search-value logging | Review the final selector/provider data path |
| Malicious point-directory content | Strict response schema, output escaping and trusted map/link construction | Provider-specific hostile-content test |
| Duplicate shipment after ambiguous timeout | Durable booking idempotency, reservation-before-call and reconciliation/manual-review state | Exercise provider timeout and lookup/retry behaviour |
| Forged, replayed or out-of-order shipping webhook | Provider authentication, timestamp policy, event deduplication and normalized state machine | Independent provider-specific review and sandbox exercise |
| Label, barcode or collection code disclosure | Restricted short-lived storage/access; exclude from logs, tickets and public URLs | Review final label workflow and incident response |
| Tracking/order enumeration | High-entropy customer access, authorization, generic failures and rate limiting | Test public order-status and tracking surfaces |
| Aggregator compromise, outage or lock-in | Least-privilege credentials, monitoring, data export/exit evidence and CYPH/1 provider abstraction | Approve contingency and contract-exit plan |
| Excess shipping data shared | Per-service outbound field allowlist and processor data-flow review | Approve contract, DPA and live payload samples |

## Data minimisation

- Do not store raw card details, provider credentials, authentication tokens or unnecessary provider payloads.
- Do not include customer/address data in reconciliation CSV unless a separately reviewed operational need is established.
- Audit summaries contain identifiers, amounts, reasons and state changes only.
- Synthetic records only in local, preview and load testing.
- Do not persist unsuccessful collection-point searches or raw customer
  coordinates without an approved purpose.
- Keep customer contact/address data separate from the immutable public
  collection-point snapshot.
- Treat shipping labels, pickup codes, proof-of-delivery material and detailed
  tracking events as restricted operational data.

The full shipping control baseline and launch evidence are defined in
`docs/operations/SHIPPING-PRIVACY-AND-SECURITY.md`.

## Review rule

This document records the engineering model, not launch approval. Any new provider, public endpoint, customer account capability, product claim, market or processor requires the model to be reviewed and dated again.
