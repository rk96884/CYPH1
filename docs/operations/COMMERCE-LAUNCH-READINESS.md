# Commerce launch-readiness register

**Status:** Milestone 4 working register  
**Production commerce:** Not approved; checkout and live providers remain disabled

This register separates evidence that can be produced by the repository from business, legal and operational approvals. An item is not complete merely because an implementation exists.

## Automated evidence

| Gate | Current evidence | Status |
| --- | --- | --- |
| Public-site build and type safety | `npm run check` and `npm run build` | Automated in CI |
| Commerce domain and API behaviour | `npm run test:commerce` | Automated in CI |
| Structural accessibility | Public and private generated-page audits, plus `docs/accessibility/PRIVATE-COMMERCE-MANUAL-REVIEW.md` | Automated baseline and local private-interface manual matrix passed; native settings, physical-device and production assistive-technology checks remain outstanding |
| Internal links and contact links | `scripts/audit-links.mjs` against generated pages | Automated in CI |
| First-party payload and JavaScript budget | `scripts/audit-performance.mjs` | Automated in CI; field performance outstanding |
| Database migrations and constraints | Checksum-aware migration runner and `npm run db:verify` | Verified against development Render PostgreSQL; must be repeated per environment |
| Duplicate payment events | Webhook integration test covers repeated and stale events | Covered |
| Transactional communication duplication | Independent semantic delivery keys and provider idempotency key | Baseline covered; provider-specific test outstanding |
| Public commerce isolation | Ordinary build omits private routes unless explicit presentation flags are supplied | Covered; deployment configuration review remains mandatory |
| Secret namespace and tracked-source audit | Runtime rejects secret-like `PUBLIC_` names; `npm run audit:commerce-security` scans tracked source in CI | Automated baseline and current Render, Cloudflare, GitHub, Brevo and registrar staging inventories reviewed; Mollie, rotation provenance, independent review and production inventories remain outstanding |
| Operations identity boundary | Access adapter verifies signature, issuer and audience and maps verified email to server-side grants; runtime forwards only `/operations/*` | Automated baseline and protected staging boundary manually verified; production review remains outstanding |
| Staging request observability | Server-generated request correlation and bounded privacy-safe JSON request events | Automated field/omission tests covered; provider alerts and production retention remain manual launch gates |
| Staging health/readiness monitor | Scheduled exact-response checks with timeout and native Actions failure state | Secret configured; healthy baseline, controlled suspension failure and operator-assisted restart recovery verified on 31 August 2026; production alert ownership remains outstanding |
| Staging incident ownership | Role-based staging response and escalation runbook covering GitHub, Render, Cloudflare Access and database signals | Project owner is accountable for staging; notification-channel tests, independent backup and production ownership remain outstanding |
| Customer runtime route isolation | Separate runtime exposes generic health/readiness plus independently gated checkout and Mollie webhook routes; operations paths remain absent | Automated baseline, protected staging deployment, guarded synthetic fixture and read-only route-gate verifier covered; Mollie checkout-disable/webhook-continuity rehearsal outstanding |
| Database recovery verification | Guarded source/restore comparison checks migration history and aggregate row counts without reading personal-data fields | Engineering command and isolated-restore runbook covered; first logical restore, paid Render PITR and off-platform schedule remain outstanding |
| Dependency vulnerability baseline | Locked install plus fail-closed production audit and narrowly matched, expiring build-tool exception; weekly npm and GitHub Actions update monitoring | Production audit clean; temporary Astro language-server exception expires 8 October 2026; deployed runtime review and ownership remain outstanding |
| Checkout abuse boundary | Explicit per-process concurrency and rolling-window admission protects checkout without limiting webhooks | Automated application baseline covered; Cloudflare policy, direct-origin restriction, staging burst evidence and production thresholds remain outstanding |
| Read-only staging performance | Bounded exact-response health/readiness probe with request, concurrency, timeout and p95 limits | Harness covered in CI; first 40-request staging probe passed on 7 September 2026 with p95 198 ms and post-probe monitor run #50 passed; resource evidence and production capacity interpretation outstanding |
| Database interruption recovery | Customer and operations readiness transition tests plus managed exercise runbook | Local healthy/unavailable/recovered transitions covered; isolated managed database, alert, pool recovery and invariant evidence outstanding |
| Worker restart and exhaustion | Durable claim leases, bounded retries and terminal exhaustion for fulfilment and communications | Engineering baseline and Render development migration covered; managed restart rehearsal, provider idempotency and alert ownership outstanding |
| Logging and reconciliation-export minimisation | Exact request-log field set plus fixed reconciliation CSV column allowlist and prohibited-data canaries | Automated engineering boundary covered; deployed processors, access, retention, deletion and production privacy approval remain outstanding |
| Deployed staging secrets and access | Variable-name inventories, account membership, MFA, external integrations, protected source history and registrar controls | Current Render, Cloudflare, GitHub, Brevo and domain checks passed on 10–11 September 2026; DNSSEC active; Mollie, independent review and production separation remain outstanding |
| Dual-runtime staging monitor | Separate exact-response customer and operations health/readiness jobs with bounded labels and independent manual failure inputs | Automated baseline and independent healthy/failure/notification/recovery staging sequence passed on 12 September 2026; legacy single-origin secret removed; production ownership and objectives remain outstanding |
| Personal-data incident tabletop | Five-inject synthetic scenario covering awareness, containment, processor escalation, changing risk and phased reporting | `PDI-TTX-001` passed on 12 September 2026 without live action or real data; legal/privacy ownership, restricted registers, processor routes, communications, retention and production approval remain outstanding |
| Disabled-state deployment recovery | Latest-commit customer staging redeploy with unchanged fail-closed controls, read-only route checks and dual-runtime monitoring | `CDR-DRILL-001` passed on 12 September 2026 using commit `9e36f9e`, monitor runs `#85` and `#87`, and exact disabled route checks; source rollback and Mollie webhook-continuity exercises remain outstanding |

## Engineering tests still required

- Complete and retain the keyboard-only, screen-reader, 200%/400% zoom,
  mobile-device, reduced-motion and high-contrast evidence in
  `docs/accessibility/PRIVATE-COMMERCE-MANUAL-REVIEW.md`.
- Checkout provider timeout, ambiguous response and abandoned-session exercises against the provider sandbox.
- Full and partial refund, cancellation, return and dispute scenarios against provider and fulfilment sandboxes.
- Database interruption, worker restart, retry exhaustion and provider-outage exercises.
- Load and soak tests using synthetic records only; no production personal data.
- First isolated logical restore, paid Render PITR rehearsal and off-platform
  backup-schedule verification.

## Security and access review

- [x] Engineering threat model documented and dated; accountable pre-launch re-review remains required.
- [ ] Production and preview secret inventories reviewed; no secret is exposed through `PUBLIC_` variables, source, logs or build artefacts.
- [x] Current staging account and variable-name inventories reviewed for Render,
      Cloudflare, GitHub, Brevo and the registrar; Mollie, credential rotation,
      independent least-privilege review and all production inventories remain
      outstanding.
- [ ] Operations identity middleware and least-privilege role mappings independently reviewed.
- [ ] Database, Render, Cloudflare, GitHub and payment-provider access owners reviewed with multi-factor authentication enabled.
- [ ] Webhook endpoint allowlists, signature/authenticity checks and raw-body handling reviewed per provider.
- [x] Engineering logging and reconciliation-export allowlists reviewed and
      regression-tested to exclude unnecessary personal data and payment
      credentials; deployed processor, access, retention and production privacy
      reviews remain outstanding.
- [x] Automated dependency vulnerability baseline and update monitoring
      documented; deployed runtime review, alert ownership and pre-launch repeat
      remain outstanding.

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
- [x] Payment-provider outage and ambiguous-payment engineering procedure
      documented; Mollie sandbox exercise and production ownership remain open.
- [x] Daily payment/order/refund reconciliation engineering procedure and
      exception-capable export documented; Mollie sandbox exercise, finance
      approval and production ownership remain open.
- [x] Fulfilment outage, bounded automatic retry and manual-review engineering
      procedure documented; provider-specific sandbox exercise and production
      ownership remain open.
- [x] Personal-data incident escalation engineering procedure documented;
      synthetic tabletop passed; privacy/legal approval, named primary/backup
      owners, restricted registers and verified processor contacts remain open.
- [x] Controlled rollback and commerce-disable engineering procedure
      documented; customer runtime now has independent checkout/webhook gates,
      and the disabled-state deployment drill passed; source rollback, Mollie
      webhook continuity and production approval remain open.

## Launch rule

Production configuration must remain disabled until every applicable item is evidenced, its accountable owner records approval, and the controlled-launch checklist is signed off. Passing CI is necessary but is not launch approval.
