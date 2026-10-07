# CYPH/1 commerce launch control register

**Updated:** 7 October 2026
**Status:** Authoritative K-803 Christmas 2026 launch control register
**Production commerce:** NOT APPROVED; this plan does not enable checkout or live providers
**Internal launch-ready target:** 16 November 2026
**Absolute readiness deadline:** 25 November 2026

Objective: be capable of accepting genuine customer orders at least one month before Christmas. Dates are targets, not permission to launch with an open safety, compliance or approval gate. If readiness is not evidenced by 25 November, record NO-GO and escalate the launch decision; do not bypass gates.

## Product decision and control rules

**PR-01 — IONKA K-803: SELECTED**, confirmed by the project owner on 7 October 2026. Selection does not approve compliance, claims, specifications, pricing, warranty or launch. Older product-not-selected wording in the project brief is superseded only for this selection decision; its evidence and pre-launch safeguards still apply. Do not transfer K-902, SKN011, Semlamp or other candidates' specifications or evidence to K-803.

**CycleSense: R&D / NOT A K-803 COMMERCE LAUNCH BLOCKER.** Keep it and discretionary enhancements outside the launch critical path; do not imply K-803 has unverified CycleSense capabilities.

This is the single launch control register. The retained evidence/checklists below support the gates; they are not competing launch decisions. Statuses mean: SELECTED = product decision only; IN PROGRESS = evidenced work underway; BLOCKED = required input/approval absent; PENDING DECISION = accountable choice outstanding; DRAFT APPROVED = draft accepted, not production-approved; READY = evidence complete and awaiting authorised release; COMPLETE = approved gate closed. No gate is READY/COMPLETE merely because code exists or CI passes.

The project owner must assign an accountable owner/deputy to each gate, record dated evidence and approval here, and review blockers against the target windows. Do not claim physical testing or supplier review is IN PROGRESS without evidence. GO-01 remains blocked until all applicable gates and the retained business/security/operations checks close.

## Critical launch gates

All target dates below are in 2026. Repository areas are unlocked for implementation/review, not automatic public activation. Preparatory work may run in parallel; final approval follows the listed dependencies.

| Gate | Status | Dependency | Evidence / decision required | Target date | Repository areas unlocked | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| PR-01 — IONKA K-803 selection | SELECTED | Project-owner decision | Selection recorded above; remaining gates independently required | 7 Oct | K-803-specific planning and evidence mapping | Freeze the exact supplier/product identity and document revision by 11 Oct |
| PT-01 — K-803 product testing | BLOCKED | PR-01; correct physical unit and supplier instructions/evidence | Identified sample, test protocol/results, defects and acceptance decision; no testing completion evidenced here | 7–16 Oct | Product acceptance and supported content inputs | Confirm sample access, assign testing owner and record findings against the frozen unit |
| CO-01 — K-803 UK compliance | BLOCKED | PR-01; K-803-specific supplier dossier; PT-01 findings for closure | Competent review of applicable UK requirements, model-specific documents/test reports, labels/instructions, claims and accountable sign-off; no certification inferred | 7–16 Oct | Approved claims, instructions and compliance content | Obtain/freeze K-803 evidence by 11 Oct; log gaps and obtain qualified review |
| PX-01 — final retail price / economics | PENDING DECISION | PR-01; supplier quote; SH-01 cost input; RT-01/WR-01 cost assumptions | Approved landed costs, tax/payment/fulfilment/returns/warranty costs, margin and retail price | 7–18 Oct | Product/checkout price and financial email values | Build economics in parallel with testing; approve final price with fulfilment costs |
| SH-01 — shipping method/cost/delivery estimate | PENDING DECISION | PR-01; package/stock facts; carrier suitability; PX-01 cost alignment | Approved destinations, method, charge, supported delivery estimate, fulfilment/stock and dispatch arrangements | 7–18 Oct decision; 16–23 Oct policy | Shipping configuration, delivery copy and order-confirmation context | Obtain quotes and package/stock evidence; decide fulfilment and approved customer wording |
| SH-02 — carrier/tracking | BLOCKED | SH-01; confirmed delivery provider and integration data | Carrier/service acceptance, actual tracking URL/reference source, safe missing-URL behaviour and provider test evidence | 18 Oct carrier decision; 19–30 Oct integration | Fulfilment adapter and dispatch tracking context | Confirm provider contract/data format; supply URLs from shipping data, never infer from names |
| PAY-01 — production payment readiness | BLOCKED | PX-01, SH-01; final terms/privacy; production access/merchant approvals | Existing Mollie assessments plus final configuration, applicable merchant obligations, authorised live payment/webhook/refund/reconciliation evidence and owner sign-off | 19–30 Oct configuration; 26 Oct–6 Nov rehearsal | Production payment/customer runtime configuration | Prepare configuration/access review now; schedule controlled live validation only after commercial approval |
| EM-01 — final transactional email configuration | DRAFT APPROVED | PR-01, PX-01, SH-01, SH-02, RT-01, WR-01; sending-provider readiness | PR #90 four visually approved drafts; final product/price/delivery/policy data, sender/provider setup and authoritative-event delivery/deduplication evidence | 19–30 Oct | Communications templates/context, email artwork and provider configuration | Review sender/delivery checklist now; replace only approved commercial inputs and test actual carrier data |
| RT-01 — final returns policy/page | DRAFT APPROVED | PR-01, PT-01, CO-01, SH-01, WR-01; consumer-rights review | PR #91 preserved source; approve change-of-mind, hygiene/seal, faulty/damaged goods, postage, permissible deductions and refund timing/process | 16–23 Oct | `src/drafts/returns.astro` promotion to public `/returns`, navigation and support copy | Review draft against K-803/final policy; only then promote, check links and rerun launch validation |
| WR-01 — final warranty | PENDING DECISION | PR-01; K-803 supplier terms; PT-01/CO-01; support/returns arrangements | Approved K-803 warranty duration, scope, exclusions, remedies, claims responsibility and statutory-rights wording; draft duration is not approval | 16–23 Oct | Warranty, returns/support and product content | Obtain supplier warranty evidence; approve customer terms without importing another model's promise |
| WEB-01 — production K-803 product content | BLOCKED | PT-01, CO-01, PX-01, SH-01, RT-01, WR-01 for final copy | Approved model-specific imagery, description, supported claims, price, instructions and policy links; accessible content review | 12–23 Oct | Public product pages/assets, metadata and approved checkout presentation | Prepare content structure/assets checklist now; populate only evidenced K-803 information |
| OPS-01 — end-to-end operations rehearsal | BLOCKED | PAY-01, SH-01, SH-02, EM-01, RT-01, WR-01; appointed operators | Full order/payment/fulfilment/dispatch/return/refund rehearsal, duplicates/uncertainty/recovery, communications, reconciliation and support handoffs; authorised production-like/provider evidence | 26 Oct–6 Nov | Operations runbooks, provider readiness and release evidence | Prepare scenarios/roles now; reuse implemented safeguards and close provider-specific gaps |
| QA-01 — final launch QA | BLOCKED | WEB-01, OPS-01 and all final production configuration/policies | Final build/type/security/link/accessibility/mobile checks, approved price/policy consistency, route/secret boundaries, deployment/recovery and blocker triage | 2–9 Nov; blocker fixes/rechecks 9–15 Nov | Frozen release candidate and readiness recommendation | Prepare QA matrix now; start independent checks while OPS runs, close only on final evidence |
| GO-01 — production go-live approval | BLOCKED | All gates above; retained governance/security/operations sign-offs | Dated accountable GO/NO-GO, named release/support owners, rollback/monitoring and controlled activation plan; genuine orders only after approval | 16 Nov internal target; 25 Nov absolute deadline | Authorised public commerce activation | Review progress at each window; reserve approval/release slot and escalate unresolved blockers |

## Target plan

| Window (2026) | Required outcome |
| --- | --- |
| 7–11 Oct | K-803 supplier/product evidence freeze |
| 7–16 Oct | K-803 compliance review and physical testing |
| 7–18 Oct | Landed economics, retail price and fulfilment decision |
| 12–23 Oct | K-803 website/product content |
| 16–23 Oct | Returns, warranty, delivery and cancellation policy finalisation |
| 19–30 Oct | Production commerce configuration and transactional-email finalisation |
| 26 Oct–6 Nov | Full order/payment/fulfilment/dispatch/return/refund operational rehearsal |
| 2–9 Nov | Launch QA |
| 9 Nov | Code/content freeze |
| 9–15 Nov | Launch-blocker fixes only |
| 16 Nov | INTERNAL LAUNCH-READY TARGET |
| 25 Nov | ABSOLUTE READINESS DEADLINE |

After 9 November, only launch blockers, compliance corrections and critical defects may change production code/content. Record the reason, approval and focused revalidation for each exception. CycleSense and discretionary enhancements remain outside the critical path. Continue required security/compliance review; the freeze is not a reason to ship a known blocker.

## Streamlining and parallel work

1. **Proceed immediately:** in parallel, assign gate owners/evidence slots; prepare the K-803 evidence/test matrix and content structure; review existing email sender/configuration requirements; prepare QA and order-to-refund rehearsal scripts, operator/support handoffs and deployment/rollback checklists. Reuse existing infrastructure; do not rebuild it or publish placeholders. PX-01/SH-01 modelling and RT-01/WR-01 review preparation need not wait for every compliance result.
2. **Supplier/compliance blockers:** exact K-803 sample, instructions, model-specific compliance/claims documents, package/stock facts and warranty evidence block final PT-01/CO-01 and parts of SH-01/WR-01/WEB-01. Obtain them in one 7–11 Oct evidence freeze; do not substitute other candidates' evidence.
3. **Commercial blockers:** price/margin, fulfilment/carrier choice, shipping charge/estimate, returns/cancellation rules and warranty responsibility block final PX-01/SH-01/SH-02/RT-01/WR-01 and downstream EM-01/PAY-01/WEB-01. Resolve the interdependent economics/fulfilment costs together, while policy/legal review proceeds in parallel. WEB-01 may prepare structure before all copy is approved; OPS-01 scenarios and early QA may proceed before final provider readiness.
4. **Go-live-only:** after evidence closes, complete authorised live-provider validation, final production configuration/access review, owner GO/NO-GO and controlled activation with monitoring/rollback. Prepare the plan earlier, but never enable genuine orders merely to meet the calendar. Existing privacy, security, recovery and ownership gates below remain mandatory, not optional enhancements.

## Verified repository baseline and evidence interpretation

Verified against main `315cdff7e1244dfec3ca2730b245b72f2c3ffa84` on 7 October; this documentation change does not rerun operational or production tests.

- [PR #90](https://github.com/rk96884/CYPH1/pull/90) is merged: four visually draft-approved order confirmation, dispatch, cancellation and refund emails; graphical logo/social artwork; escaped multiple item rows and dynamic fulfilment context; supplied valid tracking URLs only. Recorded validation was 208 commerce tests including 14 email tests, clean npm audits, check/build/link/dependency audits and all four HTML/text preview pairs. See `apps/commerce-api/src/communications/templates.ts` and `apps/commerce-api/src/communications/communications.test.ts`. Fixture price/product/shipping/tracking values are not production defaults or final approval.
- [PR #91](https://github.com/rk96884/CYPH1/pull/91) is merged: `src/drafts/returns.astro` is preserved outside routing and remains unpublished. Its warranty/returns wording is draft material, not approved K-803 policy. Selection alone does not authorise promotion to `/returns`.
- [PR #89](https://github.com/rk96884/CYPH1/pull/89) and [PR #83](https://github.com/rk96884/CYPH1/pull/83) are merged. Existing refund uncertainty/pre-submission fencing, protected balances, provider-ID retention where possible, webhook convergence and completion deduplication remain authoritative. Approved-return refunds require both permission boundaries and block duplicate/parallel refunds. Local real-PostgreSQL evidence records 30 returns checks and 11 refund-uncertainty checks including actual process exit/restart; these are not production approval. See `docs/operations/COMMERCE-OPERATIONS.md`, `docs/operations/MERCHANDISE-RETURNS-PHASE-3.md` and `apps/commerce-api/scripts/rehearse-refund-uncertainty.mjs`.
- The dated [evidence correction record](COMMERCE-LAUNCH-READINESS-EVIDENCE-CORRECTIONS-2026-09-25.md) and underlying production recovery evidence record completed PITR and off-platform backup engineering exercises. Retention, ownership, key custody and future real-data recovery controls remain gates. Mollie access/MFA/settlement, API-authoritative webhook and hosted-checkout architecture assessments are recorded; ordinary Mollie Payments is assessed as an independent-controller relationship, not an automatic Article 28 processor-DPA gap. Final privacy wording, applicable merchant PCI obligations, controlled live commerce validation and accountable approval remain open. Historical staging/test evidence below must not be read as production launch approval.
- Existing audit-policy exception still expires **8 October 2026**, without extension. Reconfirm the locked dependency baseline at expiry and release; do not add allowances or weaken thresholds. No dependency or audit-policy changes are made here.

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
| Customer runtime route isolation | Separate runtime exposes generic health/readiness plus independently gated checkout, privacy-minimised order-status and Mollie webhook routes; operations paths remain absent | Automated baseline, protected staging deployment and guarded synthetic fixture covered; controlled Mollie test checkout-disable/webhook-continuity rehearsal passed on 18 September 2026. On 23 September the private confirmation page was verified against an existing authoritative paid order: wrong-origin status access failed 403, the configured storefront received only the coarse paid state, the pending page transitioned to success without a new payment, and the disabled baseline was restored and rechecked; production approval remains outstanding |
| Database recovery verification | Guarded source/restore comparison checks migration history and aggregate row counts without reading personal-data fields | Local isolated restore passed on 21 September 2026. On 22 September a real encrypted development backup was uploaded to private EU R2, retrieved, decrypted and restored into fresh isolated PostgreSQL 17; the guarded comparison passed across all 23 required tables without reading personal-data fields. Daily encrypted development backups and an independent 36-hour freshness monitor are scheduled; real-green, deliberate-red notification and final-green monitor evidence passed. Production PITR recovery engineering evidence passed on 24 September; remaining governance and future real-data recovery controls remain open |
| Dependency vulnerability baseline | Locked install plus fail-closed production audit and narrowly matched, expiring build-tool exception; weekly npm and GitHub Actions update monitoring | Production audit clean; temporary Astro language-server exception expires 8 October 2026; deployed runtime review and ownership remain outstanding |
| Checkout abuse boundary | Explicit per-process concurrency and rolling-window admission protects checkout without limiting webhooks | Automated application baseline, Cloudflare staging policy, direct-origin restriction and bounded staging enforcement are covered. On 23 September a 12-request/concurrency-2 isolation run with Cloudflare temporarily raised returned exactly 4 validation 400, 8 application 429 and 0 edge 429 at the configured application limit of 4 requests/10 seconds; the Cloudflare staging rule was then restored to 5 requests/10 seconds with a 10-second block. These deliberately low staging values are enforcement evidence, not production capacity approval; production thresholds and alert ownership remain outstanding |
| Read-only staging performance | Bounded exact-response health/readiness probe with request, concurrency, timeout and p95 limits | Harness covered in CI; first 40-request staging probe passed on 7 September 2026 with p95 198 ms and post-probe monitor run #50 passed; resource evidence and production capacity interpretation outstanding |
| Database interruption recovery | Customer and operations readiness transition tests plus managed exercise runbook | Managed Render development interruption rehearsal passed on 22 September 2026: customer health stayed 200, readiness changed 200→503→200 across database suspension/resume, GitHub monitor run #151 detected the outage, and recovery run #152 passed for both customer and operations without service restarts; production ownership and invariant review remain outstanding |
| Worker restart and exhaustion | Durable claim leases, bounded retries and terminal exhaustion for fulfilment and communications | Guarded lease/reclaim/exhaustion rehearsal passed locally and on Render development on 21 September 2026; guarded real child-worker process interruption/replacement recovery passed locally and against Render development PostgreSQL on 22 September 2026 with the same durable event key and stable CYPH/1 fulfilment idempotency key. On 22 September the privacy-safe terminal-failure monitor also passed zero/synthetic/rollback-zero Render development rehearsal, the merged GitHub Actions monitor passed cleanly, a manual-only deliberate workflow failure reached the project owner through GitHub notifications without changing database state, and a final normal run returned green. External-provider idempotency and named production owner/deputy remain outstanding |
| Logging and reconciliation-export minimisation | Exact request-log field set plus fixed reconciliation CSV column allowlist and prohibited-data canaries | Automated engineering boundary covered; protected sandbox reconciliation export and guarded rollback-only exception-visibility rehearsal passed on 22 September 2026; deployed processors, access, retention, deletion and production privacy approval remain outstanding |
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
- Guarded real worker process-interruption/replacement recovery passed locally and against Render development PostgreSQL on 22 September 2026: a real child process was terminated after its durable claim, immediate reclaim remained lease-blocked, and replacement recovery preserved the same event key and CYPH/1 fulfilment idempotency key. Development terminal-failure alerting is also PASSED: aggregate-only synthetic detection and rollback passed against Render development, the real GitHub Actions monitor passed at zero/zero, a manual-only deliberate workflow failure reached the project owner through GitHub notifications without database mutation, and the subsequent normal run returned green. Named production owner/deputy and response expectations remain open. External-provider idempotency remains open. The Mollie test-mode checkout-containment/recovery exercise passed on 22 September 2026. The same-session in-flight webhook replay was not repeated during that containment window; separate controlled duplicate/classic-webhook replay evidence from 21 September supports idempotent reconciliation without duplicate fulfilment. Retryable-refund reservation safety passed by deterministic automated evidence in PR #28 (`5edccfc`): a retryable provider failure marked the refund `resolution_required`, retained the ambiguous amount as reserved, blocked an unsafe replacement refund, and made no second provider refund call. Production ownership and live-provider operational validation remain open. The managed Render development database interruption/recovery rehearsal passed on 22 September 2026; guarded worker database lease/reclaim/retry-exhaustion evidence passed locally and on Render development on 21 September 2026.
- Daily payment/order/refund reconciliation engineering exercise is PASSED on 22 September 2026. A protected seven-row export surfaced the existing captured £2 control payment, five expired £2 attempts and the earlier fully refunded £2 transaction without customer identity/address or payment credentials. The guarded manual reconciliation rehearsal from `main` commit `7b26482` also passed in GitHub Actions run `35748889741`, proving that `resolution_required` checkout/refund states and an order with no provider payment remain visible; its synthetic records were rolled back. Finance approval, production ownership, cut-off/coverage and settlement/accounting controls remain open.
- Load and soak tests using synthetic records only; no production personal data.
- Production PITR and off-platform encrypted backup recovery engineering evidence passed on 24 September 2026; see the dated evidence correction record and underlying recovery records. Production ownership, approved retention, key custody/rotation and notification expectations remain open where not separately evidenced.

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
- [ ] Detailed customer-facing CYPH/1 returns page published only after policy
      approval. The prepared source is preserved at `src/drafts/returns.astro`,
      intentionally outside public routing; the existing pre-launch website
      position remains in place until the IPL product is selected. Publication
      requires final product selection; approved change-of-mind and hygiene/seal
      rules; faulty/damaged goods handling; return postage responsibility;
      deductions where legally permissible; refund timing/process; final warranty
      terms; final shipping/fulfilment arrangements; and review of statutory
      consumer-rights wording. Once approved, review the preserved page against
      the final policy, promote it to the public `/returns` route, check links and
      navigation, and rerun launch validation. Preservation in Git does not make
      the draft wording approved policy.
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
      documented; Mollie checkout-containment/recovery rehearsal passed on 22 September 2026 and deterministic retryable-refund reservation-safety evidence passed in PR #28 (`5edccfc`). The containment window did not repeat the same-session in-flight webhook replay; prior 21 September duplicate/classic-webhook evidence supports idempotent reconciliation. Production ownership remains open.
- [x] Daily payment/order/refund reconciliation engineering procedure and
      exception-capable export documented; sandbox reconciliation exercise passed
      on 22 September 2026 using the protected seven-row export plus guarded
      rollback-only exception-visibility run `35748889741`. Finance approval,
      settlement/accounting controls and production ownership remain open.
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


### Historical staging payment-test closure — 21 September 2026

After completion of the Mollie test-mode payment lifecycle and reconciliation work, `cyph1-commerce-customer-staging` was restored to the locked fail-closed baseline and redeployed successfully from current `main`. Final route verification passed: `/health` returned 200, `/ready` returned 200, `/checkout` returned 404, and `/webhooks/mollie` returned 404. Checkout, commerce, payment webhooks and the private checkout fixture are therefore closed again; payment and fulfilment providers are disabled. Remaining production-readiness work is tracked separately and does not require leaving the staging payment routes enabled.
