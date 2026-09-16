# Processor due diligence and DPA checklist

**Status:** Provider-neutral pre-contract baseline; no provider approved by this document  
**Production commerce:** Disabled  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Define the evidence CYPH/1 must obtain, review and approve before an external
organisation processes personal data for early access, commerce, payment,
hosting, communications, support, fulfilment, shipping or monitoring.

The checklist is reusable across Render, Cloudflare, Brevo, Mollie, Sendcloud,
carriers and future services. It does not assume that every provider is a
processor: actual controller, joint-controller, processor and recipient roles
must be assessed by processing purpose and contractual reality.

This is not legal advice, a completed DPIA, a transfer assessment or approval
to create an account, accept terms, send personal data or enable a production
integration. Store executed contracts, private contacts, security reports,
account identifiers and provider responses in the approved restricted
governance system—not source control.

## Approval rule

A provider may handle production personal data only when:

1. its role and data flow are documented;
2. risk-proportionate evidence shows sufficient privacy, security and
   operational guarantees;
3. required controller–processor terms and any transfer mechanism are executed;
4. outstanding risks have an accountable decision and treatment;
5. operational routes have been verified; and
6. the privacy/legal, security/technical and business owners have recorded
   approval.

A certification, sales statement, public trust page or standard DPA is evidence
to assess, not automatic approval.

## Assessment workflow

Use one restricted assessment record per legal entity and service scope.

```text
INTAKE
→ ROLE_AND_DATA_FLOW
→ INHERENT_RISK
→ EVIDENCE_COLLECTION
→ CONTRACT_AND_TRANSFER_REVIEW
→ CONTROL_VALIDATION
→ RESIDUAL_RISK_DECISION
→ APPROVED / CONDITIONALLY_APPROVED / REJECTED
→ PERIODIC_AND_CHANGE_REVIEW
→ EXIT_VERIFIED
```

`CONDITIONALLY_APPROVED` requires named conditions, owner, deadline and an
explicit rule on whether data may flow before closure. It must not become a
permanent substitute for evidence.

## 1. Intake and service identity

- [ ] Legal entity, registered address and contracting entity identified.
- [ ] Service/product, account tier, contract owner and business purpose stated.
- [ ] Provider and CYPH/1 implementation owners appointed with deputies.
- [ ] Proposed production, staging, support and test uses separated.
- [ ] Contract, order form, DPA, privacy terms, acceptable-use terms, security
      documents and service commitments collected with version/effective dates.
- [ ] Sales statements that are not contractual are marked as such.
- [ ] Renewal, notice, price-change and unilateral-term-change mechanisms known.
- [ ] Provider financial/operational dependency and replacement feasibility
      considered proportionately to service criticality.

## 2. Role and processing map

For each distinct purpose, record:

| Item | Required detail |
| --- | --- |
| Parties and roles | Controller, joint controller, processor, subprocessor or independent recipient; do not rely only on the contract label |
| Subject matter | The service operation involving personal data |
| Nature and purpose | Why and how the data is processed |
| Data subjects | Prospects, customers, recipients, staff/operators or other bounded categories |
| Personal-data categories | Exact field groups; identify special-category or criminal-offence data if any rather than assuming none |
| Sources and destinations | CYPH/1 system, browser, provider, subprocessor, carrier or other recipient |
| Frequency and volume | One-off, event-driven, continuous; credible scale range |
| Duration | Active processing, logs, backups, support copies and post-contract residuals |
| Locations | Storage, processing, access/support and backup countries/regions |
| CYPH/1 instructions | Contract/order form plus saved operational instructions |
| Provider's own purposes | Fraud, compliance, analytics, service improvement or other independent purposes requiring separate role/lawful-basis analysis |

If the provider determines material purposes and essential means for some
processing, escalate the role analysis. A processor label cannot override the
actual arrangement.

## 3. Inherent-risk screen

Record risk before relying on provider controls:

- data sensitivity, identifiability and potential harm;
- children or vulnerable people;
- payment, address, location, tracking, identity or safety information;
- volume, frequency, retention and data combination;
- monitoring, profiling, automated decisions or new technology;
- public exposure, multi-tenant or internet-facing processing;
- cross-border access/transfers and complex subprocessor chains;
- criticality to checkout, payment, fulfilment, communications or recovery;
- inability to honour rights, delete/export data or exit; and
- concentration or lock-in across multiple CYPH/1 services.

Record whether a DPIA or other specialist assessment is required. Do not use a
low commercial spend or small initial customer count as proof of low privacy
risk.

## 4. Sufficient-guarantees due diligence

### Governance and assurance

- [ ] Accountable privacy and security contacts/functions identified.
- [ ] Current policies cover security, privacy, retention, incident response,
      continuity, personnel confidentiality and supplier management.
- [ ] Relevant independent assurance reports/certifications, scope, period,
      exceptions and remediation are reviewed; expired or unrelated scope is
      not accepted.
- [ ] Material litigation, regulatory findings and recent incidents relevant to
      the proposed processing are disclosed and assessed where lawfully available.
- [ ] Audit/evidence route can support CYPH/1 accountability proportionately.

### Access and personnel

- [ ] Least privilege, role separation, joiner/mover/leaver and periodic access
      review controls described.
- [ ] Strong authentication/MFA is available and required for privileged and
      customer-account access.
- [ ] Production access is authorised, logged, reviewed and time-bounded where
      appropriate.
- [ ] Personnel and support access locations are known; confidentiality and
      training obligations are evidenced.
- [ ] CYPH/1 can configure roles without sharing accounts or credentials.

### Technical security

- [ ] Encryption in transit and at rest, key responsibility and exceptions are
      documented.
- [ ] Tenant isolation and environment separation match the risk.
- [ ] Secure development, change control, vulnerability management, dependency
      management and penetration-testing evidence are adequate for the service.
- [ ] Secrets, APIs and webhooks support server-side storage, rotation,
      least-privilege scope, replay protection and authenticated events.
- [ ] Logs are privacy-minimised, access-controlled, integrity-protected and
      retained for an approved period.
- [ ] Data export, admin, deletion and other high-risk operations are audited.
- [ ] Vulnerability reporting and remediation/escalation routes are verified.

### Availability and recovery

- [ ] Service dependencies, regions, backups, recovery objectives and recovery
      responsibilities are documented without treating marketing SLAs as proof.
- [ ] Backup encryption, access, retention, restoration and deletion/replay
      behaviour are understood.
- [ ] Outage communication and escalation routes are tested where critical.
- [ ] Recovery cannot silently resurrect erased, corrected, restricted or
      suppressed data into ordinary use.
- [ ] CYPH/1 has a safe degraded/disable path and does not depend on provider
      availability to preserve authoritative local state.

## 5. Article 28 controller–processor terms

Where CYPH/1 uses a processor, verify a binding written contract or other legal
act covers the exact service and includes:

### Processing description

- [ ] subject matter and duration;
- [ ] nature and purpose;
- [ ] personal-data types and data-subject categories; and
- [ ] CYPH/1's obligations and rights.

### Mandatory operating terms

- [ ] Processing only on CYPH/1's documented instructions, including transfers,
      unless applicable law requires otherwise, with lawful-notice handling.
- [ ] Confidentiality obligations for authorised personnel.
- [ ] Appropriate technical and organisational security measures.
- [ ] Prior specific or general written authorisation for subprocessors,
      advance change notice and a meaningful objection mechanism.
- [ ] Equivalent Article 28 protections imposed on subprocessors, with the
      primary processor responsible for their obligations to CYPH/1.
- [ ] Appropriate technical and organisational assistance with data-subject
      rights within deadlines that let CYPH/1 comply.
- [ ] Assistance with security, personal-data breach obligations, DPIAs and
      prior consultation, taking account of processing and available information.
- [ ] At CYPH/1's choice, return or deletion of personal data at contract end,
      deletion of existing copies unless law requires retention, and a usable
      confirmation/exception record.
- [ ] Information needed to demonstrate Article 28 compliance and proportionate
      audits/inspections, including action on material findings.
- [ ] Prompt warning if an instruction would infringe applicable data-protection
      law.

Record conflicts between the DPA, main terms, product schedules, online terms
and order form, including precedence. Privacy/legal counsel must decide whether
the executed package is sufficient; a checkmark is not contract advice.

## 6. Subprocessors

- [ ] Current legal entities, functions and processing/access locations listed.
- [ ] Provider distinguishes infrastructure, support, communications, analytics
      and other relevant subprocessor purposes.
- [ ] Appointment basis and customer authorisation mechanism match the DPA.
- [ ] Advance notification period and practical objection/termination options
      are adequate.
- [ ] Equivalent protections and processor responsibility are confirmed.
- [ ] Subprocessor incident, rights, deletion, audit and exit dependencies are
      included in provider evidence.
- [ ] CYPH/1 has a monitored route for changes and an owner to assess them
      before the objection period expires.

Do not assume a provider's public subprocessor webpage is complete for the
purchased service or contract version. Preserve a dated reference/version in
the restricted assessment.

## 7. International transfers and remote access

Map every transfer/access chain before selecting a mechanism. For each relevant
flow:

- [ ] Exporter/importer legal entities, roles and destination are identified.
- [ ] Assess whether the UK restricted-transfer rules apply using current ICO
      guidance.
- [ ] Relevant UK adequacy regulations are confirmed for the specific flow; do
      not infer them from an EU region label.
- [ ] If relying on appropriate safeguards, the executed UK IDTA, UK Addendum,
      BCRs or other valid mechanism covers all parties/data/processing.
- [ ] The required transfer risk assessment/data-protection test is completed
      against the current factual transfer and law/practice.
- [ ] Supplementary technical/contractual/organisational measures are recorded,
      owned and validated where required.
- [ ] Government/law-enforcement request handling, transparency and challenge
      practices are assessed proportionately.
- [ ] Onward transfers and subprocessor changes cannot bypass the approved chain.
- [ ] Mechanism, adequacy status and assessment are reviewed when facts or law
      change.

Do not treat data residency as equivalent to no international transfer:
administrative or support access from another country may be relevant.

## 8. Data-subject rights

Validate the provider can support the applicable controls in
`DATA-SUBJECT-RIGHTS-OPERATIONS.md`:

- [ ] Search/export by the minimum verified identifiers and data categories.
- [ ] Intelligible access output and required metadata within CYPH/1's internal
      deadline.
- [ ] Correction without corrupting accurate historical transaction records.
- [ ] Enforceable restriction from ordinary processing.
- [ ] Field/category-specific erasure and minimal suppression where instructed.
- [ ] Recipient/subprocessor propagation and completion confirmation.
- [ ] Backup residual handling and restore-time privacy-state replay.
- [ ] No direct response to the person unless CYPH/1 authorises the arrangement.
- [ ] Tested escalation when the request is ambiguous or cannot be completed.

Record technical capability and contractual commitment separately. A dashboard
button does not prove contractual assistance; a clause does not prove the
operation works.

## 9. Incident and breach response

- [ ] Processor must notify CYPH/1 without undue delay after becoming aware of a
      personal-data breach; contract timing and trigger are explicit enough to
      protect CYPH/1's regulatory decision period.
- [ ] Verified 24/7 or risk-appropriate reporting and escalation routes exist,
      with primary/deputy ownership.
- [ ] Initial notice includes known nature, systems, people/data categories,
      timing, likely consequences, containment and contact; phased updates are
      supported.
- [ ] Evidence preservation, log availability, forensic cooperation,
      subprocessor coordination and update cadence are defined.
- [ ] Provider cannot delay notice until full investigation or unilateral
      “confirmation” where the agreed threshold is met.
- [ ] Regulator/data-subject communications and public statements preserve
      CYPH/1's controller authority unless law requires otherwise.
- [ ] Post-incident root cause, corrective action and assurance evidence are
      required.

Verify routes through a safe contact test or tabletop; do not create a false
incident.

## 10. Retention, deletion and contract exit

- [ ] Active records, logs, support copies, exports, caches and backups have
      specific periods or criteria by purpose.
- [ ] CYPH/1 can configure shorter periods where required and verify persistence.
- [ ] Legal/technical limits on granular deletion are documented with controls
      that keep residual copies beyond ordinary use.
- [ ] End-of-contract return uses a complete, documented, commonly usable format
      without avoidable lock-in or disproportionate fees.
- [ ] Deletion covers subprocessors and existing copies unless documented law
      requires retention.
- [ ] Deletion/return confirmation identifies scope, completion, residuals,
      expiry and authorised exception.
- [ ] Credentials, webhooks, integrations, support access and data flows are
      revoked safely at exit.
- [ ] A replacement/continuity plan preserves customer rights and authoritative
      records during migration.

## 11. Commercial and liability review

Privacy/legal and business owners must assess, without assuming standard terms
are acceptable:

- caps, exclusions and allocation for confidentiality, security and
  data-protection failures;
- indemnities, claims cooperation and responsibility for subprocessors;
- required insurance and evidence of cover;
- service credits versus actual recovery/transition costs;
- suspension/termination rights, data access during dispute and insolvency;
- audit, bespoke assistance, export, deletion and incident-support fees; and
- unilateral feature, location, subprocessor or term changes.

This checklist records the question and decision reference, not privileged
legal advice or negotiated contract text.

## 12. Decision and residual risk

Use one outcome:

| Outcome | Meaning |
| --- | --- |
| `APPROVED` | Evidence and executed terms meet the scoped risk; launch conditions closed |
| `CONDITIONALLY_APPROVED` | Named, time-bounded conditions and data-flow limitation approved by accountable owners |
| `REJECTED` | Risk, evidence or terms are unacceptable; no production personal data |
| `SUSPENDED` | Previously approved processing paused after change, incident or control failure |
| `EXITING` | Controlled return/deletion and replacement underway |
| `EXIT_VERIFIED` | Access/data flows revoked and return/deletion evidence accepted |

The restricted decision record includes service/version/scope, evidence dates,
material gaps, risk treatment, conditions, review triggers, approver roles and
approval dates. Do not record `APPROVED` while mandatory Article 28 or transfer
requirements are unresolved.

## 13. Per-provider assessment template

Copy this structure into the approved restricted governance system:

```text
Assessment ID:
Provider legal entity / service / tier:
CYPH/1 purpose and owner:
Assessment scope and version:
Role(s) by processing purpose:
Data subjects and categories:
Systems, flows and locations:
Subprocessors and change route:
International transfer mechanism / assessment reference:
Inherent risk:
DPIA required and reference:
Due-diligence evidence reviewed with dates:
Article 28 contract/DPA reference and gaps:
Security and recovery findings:
DSR assistance findings:
Incident route and tested date:
Retention, deletion, export and exit findings:
Commercial/liability findings:
Residual risks and treatments:
Conditions, owners and deadlines:
Decision:
Privacy/legal approver role/date:
Security/technical approver role/date:
Business owner role/date:
Next scheduled review:
Event-driven review triggers:
Exit evidence reference:
```

## 14. Current CYPH/1 provider worklist

This is scope tracking, not a role conclusion or approval:

| Service area | Current/candidate service | Evidence still required before production |
| --- | --- | --- |
| Hosting and managed database | Render | Role/data map, executed terms/DPA, locations/access, subprocessors, transfers, security, incident route, DSR, retention/backups, export/deletion and exit |
| Edge/DNS/Worker/security services | Cloudflare | Purpose-specific role map, product-specific terms, logs/security-event retention, access locations, subprocessors/transfers, incident/DSR and deletion/exit evidence |
| Early-access and transactional email | Brevo | Contact/consent/event/log scope, roles, DPA, subprocessors/transfers, rights/suppression, exact retention/backups, incident and exit evidence |
| Payments | Mollie candidate | Controller/processor purposes, payment/compliance retention, DPA/terms, subprocessors/transfers, rights/incident routes, export/exit and liability; account not yet approved |
| Shipping aggregator | Sendcloud leading candidate | Role chain with carriers, DPA, subprocessors/transfers, field allowlists, proof/tracking/returns retention, rights/incident, export/exit and contractual responsibility |
| Underlying carriers | InPost and Evri candidates | Actual role by service, aggregator/direct contract allocation, operational partners, locations, proof/tracking retention, rights/incident and deletion/claims boundaries |
| Fulfilment/3PL | Not selected | Full assessment once operating model and provider are selected |
| Support/case and secure response delivery | Not selected | Restricted-case suitability, access, evidence retention, secure disclosure, rights, recovery and exit |

Existing staging configuration checks are not substitutes for these contract and
processing assessments.

## 15. Review and change control

Set a risk-based scheduled review and trigger immediate reassessment for:

- new service, feature, data category, purpose, market or affected population;
- legal entity, controller/processor role or contract/DPA change;
- new/changed subprocessor, location, remote access or transfer mechanism;
- material incident, control failure, audit finding or regulatory action;
- retention, backup, deletion, DSR or recovery behaviour change;
- acquisition, insolvency concern or material service deterioration;
- integration or credential scope expansion;
- renewal, termination or replacement; or
- change in applicable law or ICO guidance.

An owner must monitor provider notices and preserve dated evidence. Silence is
not evidence that terms or subprocessors remained unchanged.

## Launch gates

- [ ] Restricted provider/contract register and evidence store approved.
- [ ] Each production provider has a completed role/data-flow assessment.
- [ ] Risk-proportionate sufficient-guarantees evidence accepted.
- [ ] Required Article 28 package is executed and conflicts resolved.
- [ ] Subprocessors and change/objection route approved.
- [ ] International transfers and any required mechanisms/assessment approved.
- [ ] Incident and DSR routes verified.
- [ ] Retention, backup, deletion, export and exit controls validated.
- [ ] Commercial/liability risks accepted by authorised owners.
- [ ] Primary/deputy owners and review triggers recorded.
- [ ] No unresolved mandatory item is hidden by conditional approval.

## Current-law references

- [ICO: Contracts](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/contracts/)
- [ICO: What needs to be included in the contract?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/)
- [ICO: Controller responsibilities when using a processor](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/responsibilities-and-liabilities-for-controllers-using-a-processor/)
- [ICO: Controllers and processors guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors-a-guide/)
- [ICO: International transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/)
- [ICO: Brief guide to international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-brief-guide-to-international-transfers/)

Check current guidance and obtain professional advice before executing provider
contracts. ICO guidance cited here notes that parts are under review following
changes to UK data-protection law.

## Related controls

- `COMMERCE-ACCESS-AND-SECRETS-REVIEW.md`
- `CUSTOMER-DATA-RETENTION-AND-DELETION.md`
- `DATA-SUBJECT-RIGHTS-OPERATIONS.md`
- `LOGGING-AND-EXPORT-DATA-BOUNDARIES.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `SHIPPING-COMMERCIAL-VALIDATION.md`
- `SHIPPING-PRIVACY-AND-SECURITY.md`

