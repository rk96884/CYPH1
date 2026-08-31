# Commerce launch-readiness register

**Status:** Milestone 4 working register  
**Production commerce:** Not approved; checkout and live providers remain disabled

This register separates evidence that can be produced by the repository from business, legal and operational approvals. An item is not complete merely because an implementation exists.

## Automated evidence

| Gate | Current evidence | Status |
| --- | --- | --- |
| Public-site build and type safety | `npm run check` and `npm run build` | Automated in CI |
| Commerce domain and API behaviour | `npm run test:commerce` | Automated in CI |
| Structural accessibility | `scripts/audit-accessibility.mjs` across generated public pages | Automated in CI; manual assistive-technology testing outstanding |
| Internal links and contact links | `scripts/audit-links.mjs` against generated pages | Automated in CI |
| First-party payload and JavaScript budget | `scripts/audit-performance.mjs` | Automated in CI; field performance outstanding |
| Database migrations and constraints | Checksum-aware migration runner and `npm run db:verify` | Verified against development Render PostgreSQL; must be repeated per environment |
| Duplicate payment events | Webhook integration test covers repeated and stale events | Covered |
| Transactional communication duplication | Independent semantic delivery keys and provider idempotency key | Baseline covered; provider-specific test outstanding |
| Public commerce isolation | Ordinary build omits private routes unless explicit presentation flags are supplied | Covered; deployment configuration review remains mandatory |
| Secret namespace and tracked-source audit | Runtime rejects secret-like `PUBLIC_` names; `npm run audit:commerce-security` scans tracked source in CI | Automated baseline covered; deployed inventories remain outstanding |
| Operations identity boundary | Access adapter verifies signature, issuer and audience and maps verified email to server-side grants; runtime forwards only `/operations/*` | Automated baseline and protected staging boundary manually verified; production review remains outstanding |
| Staging request observability | Server-generated request correlation and bounded privacy-safe JSON request events | Automated field/omission tests covered; provider alerts and production retention remain manual launch gates |
| Staging health/readiness monitor | Scheduled exact-response checks with timeout and native Actions failure state | Secret configured; healthy baseline, controlled suspension failure and operator-assisted restart recovery verified on 31 August 2026; production alert ownership remains outstanding |
| Staging incident ownership | Role-based staging response and escalation runbook covering GitHub, Render, Cloudflare Access and database signals | Project owner is accountable for staging; notification-channel tests, independent backup and production ownership remain outstanding |

## Engineering tests still required

- Keyboard-only, screen-reader and zoom testing of every private commerce state at small mobile, large mobile, tablet, laptop and wide desktop widths.
- Reduced-motion verification for private commerce UI.
- Checkout provider timeout, ambiguous response and abandoned-session exercises against the provider sandbox.
- Full and partial refund, cancellation, return and dispute scenarios against provider and fulfilment sandboxes.
- Database interruption, worker restart, retry exhaustion and provider-outage exercises.
- Load and soak tests using synthetic records only; no production personal data.
- Restore rehearsal from a Render backup or approved database export.

## Security and access review

- [x] Engineering threat model documented and dated; accountable pre-launch re-review remains required.
- [ ] Production and preview secret inventories reviewed; no secret is exposed through `PUBLIC_` variables, source, logs or build artefacts.
- [ ] Operations identity middleware and least-privilege role mappings independently reviewed.
- [ ] Database, Render, Cloudflare, GitHub and payment-provider access owners reviewed with multi-factor authentication enabled.
- [ ] Webhook endpoint allowlists, signature/authenticity checks and raw-body handling reviewed per provider.
- [ ] Logging and exports reviewed to exclude unnecessary personal data and payment credentials.
- [ ] Dependency and container/runtime vulnerability review completed.

## Business and regulatory approval

The following require accountable human sign-off and cannot be completed by automated tests:

- [ ] Final sellable product, claims and compliance evidence approved.
- [ ] Legal entity, merchant account and settlement account approved.
- [ ] UK consumer-contract, cancellation, returns, warranty and support terms approved.
- [ ] Privacy notice, processing records, retention schedule and processor contracts approved.
- [ ] VAT, tax, bookkeeping, reconciliation and refund accounting approved.
- [ ] PCI scope and responsibilities confirmed for hosted checkout.
- [ ] Shipping destinations, charges, duties, restricted destinations and fulfilment ownership approved.
- [ ] Incident owner, customer-support owner and escalation contacts assigned.

## Operational runbooks required

- [x] Staging commerce incident ownership and alert-routing baseline documented;
      production incident ownership and notification verification remain open.
- [ ] Payment-provider outage and ambiguous-payment handling.
- [ ] Daily payment/order/refund reconciliation.
- [ ] Fulfilment outage and manual-review processing.
- [ ] Personal-data incident escalation.
- [x] Controlled rollback and commerce-disable engineering procedure
      documented; staging rehearsal and production approval remain open.

## Launch rule

Production configuration must remain disabled until every applicable item is evidenced, its accountable owner records approval, and the controlled-launch checklist is signed off. Passing CI is necessary but is not launch approval.
