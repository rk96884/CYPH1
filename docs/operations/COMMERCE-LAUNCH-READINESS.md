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
| Production ownership and customer support | Role authority, deputy coverage, detailed support workflow, restricted-register fields and a primary-unavailable exercise are defined | Framework and provider-neutral customer-support operating procedure prepared, including verification, case routing and payment/delivery/return/privacy/safety handoffs; named appointments, private registers, approved channels/policies/templates, response commitments, access tests, exercises and accountable approval remain outstanding |
| Production ownership appointments | Appointment lifecycle, acceptance, authority schedules, private contacts, access verification, conflict review, deputy handover, revocation and primary-unavailable exercise | Provider-neutral appointment pack and privacy-safe role portfolio documented; `OWN-DRILL-001` is prepared but not run. No person is appointed by the repository. Restricted registers, named acceptance, realistic coverage, positive/negative access tests, MFA/recovery and alternate routes, conflict mitigations, exercise completion and launch-owner approval remain outstanding |
| Customer-support communications | Guarded provider-neutral templates for verification, checkout, payments, cancellations, destination/delivery, returns, warranty, refunds, disputes, safety, privacy/security, outages and closure | 23-template pack and pre-send/version controls documented. Production use remains unapproved pending final product/policies, consumer/legal, finance, fulfilment, product-safety, privacy/security, accessibility, channel and provider-state testing and accountable sign-off |
| Customer runtime route isolation | Separate runtime exposes generic health/readiness plus independently gated checkout and Mollie webhook routes; operations paths remain absent | Automated baseline, protected staging deployment and guarded synthetic fixture covered; controlled Mollie test checkout-disable/webhook-continuity rehearsal passed on 18 September 2026, including authoritative paid-order reconciliation and restoration to the disabled boundary; production approval remains outstanding |
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
| Disabled-state deployment recovery | Latest-commit customer staging redeploy with unchanged fail-closed controls, read-only route checks and dual-runtime monitoring | `CDR-DRILL-001` passed on 12 September 2026 using commit `9e36f9e`, monitor runs `#85` and `#87`, and exact disabled route checks; faulty-release recovery and Mollie webhook-continuity exercises remain outstanding |
| Customer staging source revert | Benign observable header deployed and removed with a new revert commit, with disabled route checks and post-revert dual-runtime monitoring | `CDR-DRILL-002` passed on 13 September 2026 using marker commit `1c60da8`, revert commit `f77abf3` and monitor run `#95`; compatible faulty-release recovery subsequently passed and Mollie webhook continuity remains outstanding |
| Customer staging faulty-release recovery | Compatible customer health-contract regression detected by exact-response monitoring, followed by source-controlled recovery | `CDR-DRILL-003` passed on 15 September 2026 using fault commit `36b79a2`, revert `e1d4460`, customer-only failure run `#107` and healthy dual-runtime run `#108`; Mollie webhook continuity and data/schema rollback remain outstanding |
| Customer-data retention and deletion | Category inventory, rights-request workflow, processor/backup handling and safe deletion design | Draft procedure and monthly manual early-access review method documented; 14 September age-screen baseline is zero contacts older than 24 months. Brevo's persisted account setting deletes transactional-email logs after one month for all senders and disables new previews, but exact 30-day deletion across DOI/event logs, approved engagement criteria, execution of future monthly reviews, privacy-owner decision, backup owner, restricted register and production erasure tooling remain outstanding |
| Data-subject rights handling | Six-inject synthetic tabletop, provider-neutral operating runbook and privacy-minimised restricted-register specification | `DSR-TTX-001` passed on 16 September 2026 without real data or live action. The case lifecycle, role authority, identity/search/decision workflow, processor instructions, secure response, closure controls and logical evidence model are documented. Approved ownership/retention/templates, restricted storage/access, provider capability, technical restriction, secure-delivery, isolated database deletion and restore-suppression testing remain outstanding |
| Data-subject rights communications | Guarded templates for acknowledgement, verification, clarification, marketing objection, extension, secure access, rectification, restriction, erasure, residual actions, refusal and closure | Provider-neutral 16-template pack and pre-send/version controls documented. Production use remains unapproved pending current-law/privacy review, controller/complaint details, accessibility, secure-delivery/channel testing and accountable sign-off |
| Processor due diligence and DPA | Provider-neutral intake, role/data-flow, sufficient-guarantees, Article 28, subprocessor, transfer, security, rights, incident, retention and exit checklist | Baseline and per-provider assessment template documented. No provider is approved by it; restricted evidence storage, actual Render/Cloudflare/Brevo/Mollie/Sendcloud/carrier/fulfilment/support assessments, executed terms, validations and accountable approvals remain outstanding |
| Commerce data classification and access control | Five-level classification, commerce data catalogue, role/action matrix, high-risk approvals, environment/provider boundaries, break-glass and access lifecycle | Provider-neutral baseline documented and current four application permissions identified as partial implementation only. Named assignments, field-level views, restricted registers, separation controls, production/staging/service identities, PostgreSQL/Mollie/provider mappings and negative-permission testing remain outstanding |
| Multi-carrier and collection-point delivery | ADR, logical data model, commercial/privacy baselines and outage runbook | Preferred direction recorded: generic **Locker / Collection Point**, CYPH/1-owned carrier abstraction, Sendcloud as leading aggregator candidate and InPost/Evri as candidate underlying carriers. ADR 0003 and the logical schema separate propositions, selections, services, shipments and fulfilment. Commercial validation, privacy/security and outage/recovery documents define provider evidence, minimized data flows, selector/label/webhook controls, failure classes and safe fallback. No migration or integration is approved; provider responses, final package facts, contracts, exercises and accountable approval remain outstanding. |

## Engineering tests still required

- Complete and retain the keyboard-only, screen-reader, 200%/400% zoom,
  mobile-device, reduced-motion and high-contrast evidence in
  `docs/accessibility/PRIVATE-COMMERCE-MANUAL-REVIEW.md`.
- Checkout provider timeout and ambiguous-response safety is PASSED by controlled automated evidence on `main`: the Mollie adapter enforces a bounded timeout and classifies the uncertain result as a retryable `network_error`, while checkout-service coverage verifies resolution-required handling without payment attachment, success assumption or fulfilment. Mollie test-mode `expired` handling and an end-to-end abandoned-checkout/natural-expiry rehearsal passed on 21 September 2026. Terminal provider-API `failed` and `canceled` outcomes remain unverified because they were not reproducible in the current GBP Mollie test flow; these are recorded as provider-test limitations rather than failed CYPH/1 controls.
- Partial-refund reconciliation, duplicate-webhook idempotency, and full-refund-after-partial passed against Mollie test mode on 21 September 2026. The second £1 refund on the synthetic £2 order completed through Mollie's normal webhook delivery and CYPH/1 transitioned both order and payment from `partially_refunded` to `refunded`, persisted two distinct completed £1 refund records, and left fulfilment `unfulfilled`. A failed-card-attempt rehearsal also passed the safety assertion: Mollie recorded the card attempt as failed (3-D Secure authentication failed) but kept the parent payment `Open`; CYPH/1 correctly remained order `pending_payment`, payment `pending`, fulfilment `unfulfilled`, with no refunds or fulfilments. A terminal parent-payment `failed` state was not reproducible through the current GBP Mollie test checkout and is therefore recorded as a provider-test limitation, not a pass. Final reconciliation on 21 September 2026 strengthened that conclusion: Mollie's dashboard later displayed the fresh test payment as `Failed`, but no natural webhook was visible; a controlled classic-webhook replay caused CYPH/1 to retrieve the provider's authoritative API state and persist the payment as `expired`. The order remained `pending_payment`, fulfilment remained `unfulfilled`, and there were no refunds or fulfilments. The dashboard/API discrepancy is retained as provider-test evidence; terminal API `failed` remains unverified. Explicit terminal cancellation was also investigated in Mollie test mode on 21 September 2026. The hosted payment-method screen, card-entry flow and test-status simulator exposed no `Canceled` option, and the Mollie dashboard exposed no Cancel action for the open test payment. Navigating back did not cancel the parent payment; the observed card attempt expired while the parent payment remained `Open` and returned to payment-method selection. A terminal parent-payment `canceled` state is therefore recorded as not reproducible in the current Mollie GBP test flow, not as a pass or failure. Timeout/ambiguous-provider safety is covered by controlled automated evidence on `main`: the Mollie adapter test forces a request to exceed its configured timeout and verifies a retryable `network_error`, while the checkout-service test verifies that an ambiguous retryable provider failure creates the draft order, marks it resolution-required, does not abandon it, and returns a provider error without attaching a payment or assuming success. This is recorded as PASSED by automated evidence rather than by deliberately disrupting staging connectivity. Return and dispute scenarios remain open.
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
- [ ] Data classification, field-level views, high-risk approvals, break-glass,
      service identities and negative permissions validated against the commerce
      access-control matrix.
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
- [ ] Customer-support templates legally and operationally approved against the
      final product, policies, channels and authoritative provider/application
      states; accessible delivery and semantic deduplication tested.
- [ ] Privacy notice, processing records, retention schedule and processor contracts approved.
- [ ] DSR communication templates, controller/contact/complaint wording,
      accessible formats and secure-delivery channels legally reviewed and
      tested before production use.
- [ ] Provider role/data-flow assessments, sufficient-guarantees evidence,
      Article 28 terms, subprocessors, international transfers, incident/DSR
      routes and exit controls approved under the processor due-diligence
      checklist.
- [ ] VAT, tax, bookkeeping, reconciliation and refund accounting approved.
- [ ] PCI scope and responsibilities confirmed for hosted checkout.
- [ ] Shipping destinations, charges, duties, restricted destinations and fulfilment ownership approved.
- [ ] Final packaged dimensions and weight confirmed for the selected product and
      packaging.
- [ ] Written carrier acceptance obtained for the selected mains-powered
      IPL/electronic beauty device and its external AC/DC power adapter.
- [ ] Loss and damage compensation or shipment insurance confirmed at the
      expected retail/replacement value; public consumer cover must not be
      assumed to apply to a business contract or compensate electronics.
- [ ] Sendcloud commercial suitability and entitlement validated, including
      rates, subscription/label fees, surcharges, returns and carrier-contract
      support.
- [ ] InPost and Evri business rates, geographic/service coverage, surcharges,
      return services and minimum-volume requirements confirmed.
- [ ] Incident owner, customer-support owner and escalation contacts assigned.
- [ ] Production primaries/deputies explicitly appointed, access-tested and
      exercised under the ownership appointment pack; private contacts and
      authority records independently reviewed.

The role and evidence framework for this item is recorded in
`docs/operations/PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`. It remains open
until the private appointments, deputies, channels and exercises are complete.

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
- [x] Shipping/collection-point outage and ambiguous-booking procedure
      documented; provider-specific controls, customer-content approval,
      sandbox exercises, monitoring thresholds and production ownership remain
      open.
- [x] Provider-neutral customer-support procedure documented; approved channel,
      verification implementation, policies/templates, named owners, safety and
      provider-specific handoff exercises remain open.
- [x] Personal-data incident escalation engineering procedure documented;
      synthetic tabletop passed; privacy/legal approval, named primary/backup
      owners, restricted registers and verified processor contacts remain open.
- [x] Data-subject rights exercise `DSR-TTX-001` passed and its privacy-safe
      completion record retained; provider-neutral operating and restricted-
      register specifications are documented. These do not close later
      ownership, retention, template, restricted-storage, processor,
      secure-delivery, technical-restriction, database or backup-restore gates.
- [x] Controlled rollback and commerce-disable engineering procedure
      documented; customer runtime now has independent checkout/webhook gates,
      the disabled-state deployment and benign source-revert drills passed;
      the compatible faulty-release recovery drill also passed. The controlled
      Mollie test checkout-disable/webhook-continuity rehearsal passed on
      18 September 2026; data/schema rollback and production approval remain open.

## Launch rule

Production configuration must remain disabled until every applicable item is evidenced, its accountable owner records approval, and the controlled-launch checklist is signed off. Passing CI is necessary but is not launch approval.
