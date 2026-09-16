# Commerce data classification and access control

**Status:** Provider-neutral control baseline; production roles, storage and
technical enforcement are not approved  
**Production commerce:** Disabled  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Define how CYPH/1 classifies commerce information and which roles may view,
change, export, delete or approve actions involving it. This baseline applies
across application data, provider dashboards, support cases, exports, logs,
backups and restored environments.

This document does not grant access, create a production role, approve a
provider or replace the system-specific permission model. Current code exposes
only a small permission baseline (`orders:read`, `refunds:create`,
`fulfilment:retry` and `reconciliation:export`). Every additional permission in
this document is a required design boundary, not an implemented capability.

Do not place names, personal contacts, account identifiers, credentials or
private role assignments in source control. They belong in the approved
restricted ownership/access register.

## Core principles

- Default deny and grant the minimum purpose-specific access for the minimum
  duration.
- Separate customer support, finance, fulfilment, privacy, safety and technical
  authority; access to one workflow does not imply access to another.
- Prefer bounded views and approved operations over raw database or provider
  dashboard access.
- Keep immutable historical transaction evidence distinct from editable
  reusable customer information.
- Treat export, bulk search, disclosure, deletion, refund and credential actions
  as higher risk than ordinary single-record viewing.
- Never derive permissions from browser-controlled input. Verified server-side
  identity and grants are authoritative.
- Production, staging, development, backup and restore environments have
  separate identities, credentials and data boundaries.
- Logs, screenshots and audit records are not exemptions from minimisation.
- Emergency access expires automatically and is independently reviewed.
- Provider access is constrained by the approved data flow, contract and DPA;
  it is not a substitute for CYPH/1 role control.

## Classification levels

Use the highest applicable level. Classification is based on impact and
purpose, not where the data happens to be stored.

| Level | Meaning | Typical handling |
| --- | --- | --- |
| `PUBLIC` | Approved for unrestricted publication | Public website/CDN; integrity and publishing approval still required |
| `INTERNAL` | Non-public business/technical information with limited harm if disclosed | Authenticated workforce access; no public links or source publication unless approved |
| `CONFIDENTIAL` | Commercial, operational or pseudonymous information that could harm CYPH/1 or people when combined/misused | Purpose-based roles, encrypted transfer/storage, logged access and controlled export |
| `RESTRICTED` | Direct personal, financial, security, rights, incident or detailed delivery information with material harm potential | Named authorised roles, strong authentication, field minimisation, audited operations, restricted exports and independent review for high-risk actions |
| `HIGHLY_RESTRICTED` | Credentials, authentication material, identity evidence, special-category information or exceptionally sensitive evidence | Dedicated secret/evidence store, very small access set, no routine export, short evidence retention and two-person/high-authority control where practicable |

`HIGHLY_RESTRICTED` is an operational label, not a claim that every item is a
UK GDPR special category. Conversely, health information in a product-safety
case may be special-category data even if a UI fails to label it correctly.

## Handling requirements by level

| Control | Public | Internal | Confidential | Restricted | Highly restricted |
| --- | --- | --- | --- | --- | --- |
| Authentication | Not required to read | Required | Required | Strong authentication/MFA | Strong authentication/MFA plus narrowly approved role |
| Authorisation | Publishing approval to change | Team/role | Purpose-specific role | Field/action-specific role | Named/high-authority grant; time-bound where possible |
| Encryption | TLS for delivery | TLS; approved storage | In transit and at rest | In transit and at rest; protected backups | Dedicated secret/restricted evidence controls and protected backups |
| Routine local download | Allowed for published assets | Avoid unmanaged copies | Approved task only | Exceptional, encrypted and disposal-tracked | Prohibited unless specifically authorised |
| General chat/ticket | Approved public content only | Safe summary | Non-sensitive summary/reference | Case/reference only; no payload | Never include value/evidence |
| Source control | Approved public content/code | Non-sensitive documentation/code | No live records or private evidence | Prohibited | Prohibited |
| Audit | Publishing/change history | Material changes | Read/export/change as risk requires | Read, export, change, approval and deletion | Every access/high-risk operation where supported |
| Retention | Publication schedule | Business schedule | Purpose schedule | Category-specific approved schedule | Shortest justified period plus hold/review control |
| Disposal | Withdraw/version | Approved deletion | Verified deletion | Verified deletion/anonymisation and processor propagation | Verified secure deletion/revocation; no evidence copy of secret |

## Commerce data catalogue

| Data category | Examples | Classification | Primary purpose and important restrictions |
| --- | --- | --- | --- |
| Approved public catalogue/content | Product-neutral copy, approved delivery proposition names, public policies | `PUBLIC` | Publication only after claims/content approval; draft prices/specifications are not public |
| Commercial configuration | Unpublished prices, rates, stock thresholds, carrier cost, feature state | `CONFIDENTIAL` | Commerce operation; changes require authorised business/operations workflow |
| Customer identity/contact | Name, email, telephone | `RESTRICTED` | Order, delivery, support or approved marketing purpose; do not expose in titles/logs |
| Reusable customer address | Current delivery/contact address | `RESTRICTED` | Future fulfilment/support; correct independently of historical order snapshots |
| Order and address snapshots | Items, totals, delivery/billing snapshot, tax and method evidence | `RESTRICTED` | Immutable transaction evidence; support views should minimise fields |
| Consent/suppression evidence | Purpose, status, wording/source/time, minimum suppression selector | `RESTRICTED` | Evidence and direct-marketing control; purchase cannot restore consent |
| Payment/refund records | Provider IDs, status, amount, currency, reconciliation state | `RESTRICTED` | Finance/reconciliation; never store raw card/security credentials |
| Bank/card credentials | Full card data, CVV, banking login or equivalent | `HIGHLY_RESTRICTED` / prohibited from CYPH/1 systems | Hosted provider only; CYPH/1 must not collect or log them |
| Webhook evidence | Raw body, signature result, digest, provider event | `RESTRICTED`; authentication secrets `HIGHLY_RESTRICTED` | Authenticity, replay and audit; raw content needs explicit retention and narrow access |
| Delivery selection | Home/collection type, point ID/snapshot, parcel/value eligibility | `RESTRICTED` when linked to an order | Customer-approved fulfilment evidence; search postcode/coordinates normally transient |
| Shipment/tracking | Carrier/provider IDs, tracking, status, collection deadline | `RESTRICTED` | Fulfilment/support; public tracking URLs and pickup codes require separate risk controls |
| Labels, pickup/collection codes and proof | Label/barcode, code, signature/photo/location | `HIGHLY_RESTRICTED` where it enables collection or reveals detailed evidence | Narrow fulfilment/claims use; never ordinary logs or unrestricted customer-support copies |
| Support/cancellation/return/warranty | Case content, communications, evidence, outcome | `RESTRICTED` | Bounded case handling; separate payment, fulfilment, safety and privacy decisions |
| Product-safety/adverse-event evidence | Injury, symptoms, images, medical/health detail | `HIGHLY_RESTRICTED`; may be special-category data | Collect only under approved safety/legal process; not ordinary support access |
| DSR/identity evidence | Rights case, identity check, disclosure package, decisions | `HIGHLY_RESTRICTED` for identity evidence/packages; register metadata `RESTRICTED` | Privacy/legal process; do not retain unnecessary ID or deleted data as evidence |
| Incident/security evidence | Access evidence, affected records, forensic material | `HIGHLY_RESTRICTED` or `RESTRICTED` by content | Need-to-know incident/privacy use; safe summaries outside evidence store |
| Reconciliation export | Allowlisted order/payment/fulfilment identifiers | `CONFIDENTIAL`, elevated to `RESTRICTED` if personal fields appear | Finance only; any unexpected personal/secret field is an incident signal |
| Application operational logs | Bounded event, route class, status, request ID, duration | `INTERNAL`/`CONFIDENTIAL` | Diagnostics; must exclude personal data, secrets and provider payloads |
| Audit events | Actor, action, entity reference, safe summary | `CONFIDENTIAL`; `RESTRICTED` when linkable to customer/rights activity | Accountability; safe bounded summary, protected against alteration |
| Credentials and access assertions | API keys, database URL, session/assertion, signing secrets, recovery codes | `HIGHLY_RESTRICTED` | Encrypted secret/identity systems only; never browser data, logs, exports or repository |
| Backups and restored environments | Database/log/export copies | Same as highest included data | Isolated, encrypted and access-controlled; privacy-state replay before ordinary use |

## Role definitions

| Role | Permitted purpose |
| --- | --- |
| Customer support | Verify requester, view minimum order/delivery status and coordinate approved cases |
| Finance/reconciliation | Payment/refund/reconciliation review and approved financial actions |
| Fulfilment/shipping | Paid-order destination, shipment, carrier and return operations |
| Product-safety/compliance | Safety/warranty evidence and approved regulatory/product decisions |
| Privacy/legal | DSR, incident, retention, restriction, disclosure and legal-hold decisions |
| Technical operations | Availability, deployment, bounded diagnostics and approved recovery—not routine customer browsing |
| Security/incident response | Containment and restricted evidence for an active authorised incident |
| Business/launch owner | Policy/configuration approval and risk acceptance; not routine record access |
| Service identity | One bounded application/provider task with non-human credential and explicit scope |
| Independent reviewer | Verify high-risk action/evidence without inheriting implementation authority |

Names, deputies, employment arrangements and private contacts belong in the
restricted ownership register. One person may initially hold multiple roles,
but must deliberately assume the correct role and preserve independent review
where the matrix requires it.

Appointments, authority acceptance, access verification, conflict review and
deputy exercises must follow
`PRODUCTION-OWNERSHIP-AND-DEPUTY-APPOINTMENT-PACK.md`.

## Role and action matrix

Legend:

- `R` — read through an approved minimised view;
- `W` — execute an approved bounded change/command;
- `X` — controlled export/disclosure;
- `A` — approve or independently review;
- `E` — emergency/time-bound access only;
- `—` — no access by default.

| Data/action | Support | Finance | Fulfilment | Safety | Privacy/legal | Tech ops | Security/incident | Business owner | Independent reviewer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer/order summary | `R` | `R` minimum | `R` fulfilment fields | `R` case-linked | `R` case-linked | `E` | `E` | Aggregates only | `R` as required |
| Reusable contact/address correction | Initiate | — | Initiate destination workflow | — | `A` for rights case | Implement approved control | — | — | Review high-risk exception |
| Historical order/address snapshot | `R` minimum | `R` | `R` | `R` case-linked | `R/A` | `E` | `E` | Aggregates only | `R/A` |
| Payment/refund detail | Status minimum | `R/W/X` bounded | Paid/not-paid state only | — | `R` case-linked | `E` | `E` | Aggregates only | `A` high-risk/refund policy |
| Refund creation | Initiate | `W` | — | — | — | — | `E` only for incident containment, not outcome | Policy approval | `A` per threshold |
| Shipment/collection detail | `R` minimum | Cost/status minimum | `R/W` | `R` safety-linked | `R` case-linked | `E` | `E` | Aggregates only | Review exception |
| Pickup code/label/proof | Recovery route only; no routine code view | — | `R/W` minimum | `R` case-linked evidence | `R` case-linked | `E` | `E` | — | `A` where required |
| Marketing consent/suppression | Status minimum | — | — | — | `R/W/A` for rights | Implement approved control | `E` | Policy approval | Review |
| DSR case/disclosure package | Route only | Decision input only | Decision input only | Decision input only | `R/W/X/A` | Approved search/action only | `E` if incident-linked | Governance only | `A` |
| Safety/health evidence | Route only | — | Case facts only | `R/W/X` | `R/A` | `E` | `E` | Governance only | `A` |
| Incident evidence | Safe status only | Case input | Case input | Case input | `R/A` | `R/W` technical evidence | `R/W/X` | Governance/risk decision | `A` |
| Reconciliation export | — | `X` | — | — | `R` only if authorised case requires | Generate/maintain control, no routine contents | `E` | Aggregates only | `A` export control |
| Raw webhook payload | — | `E`/case-specific | `E`/case-specific | — | `E` | `E` diagnostic | `E` incident | — | `A` control review |
| Production database console | — | — | — | — | — | `E` only | `E` only | — | `A` emergency review |
| Credential/secret value | — | Provider role only where essential | Provider role only where essential | — | — | `R/W` minimum secret scope | `E` | — | Rotation/access evidence, never value |
| Retention/erasure decision | Input | `A` financial basis | Input | Input | `A` | Implement only | Incident hold input | Risk/policy approval | `A` |
| Bulk deletion/anonymisation | — | — | — | — | `A` | `W` approved tooling | `E` containment only | Risk approval where required | `A` |
| Restore to ordinary use | — | Reconciliation input | State input | — | Privacy-state approval | `W` | Security approval after incident | Business continuity decision | `A` |

The matrix sets maximum intended authority. Every access still requires a real
case/task, appropriate state, field minimisation and implemented permission.
`E` never means standing access.

## High-risk operations and separation

The following require an authorised initiator plus independent approval/review
appropriate to the risk and team size:

- bulk export or disclosure of restricted data;
- irreversible deletion/anonymisation or retention-exception application;
- production database console access or direct repair;
- refund above an approved threshold or exceptional/manual financial action;
- change to price, tax, shipping charge or live payment/provider configuration;
- viewing/exporting identity documents, safety/health evidence or DSR packages;
- granting privileged roles, disabling MFA/audit controls or creating a broad
  service credential;
- restoring data to ordinary production use; and
- overriding a failed restriction, reconciliation, webhook or privacy-state
  replay control.

Where staffing prevents simultaneous two-person control, production remains
blocked unless an accountable owner approves an alternative with time-bounded
access, immutable evidence and prompt independent retrospective review. A
person cannot meaningfully approve their own unrestricted action merely by
switching role labels.

## Environment boundaries

### Production

- Real personal data only after launch approval.
- Human access through approved protected interfaces; raw database/provider
  access is exceptional and time-bound.
- Production credentials never flow to staging, previews, local machines or CI
  jobs that do not require them.

### Staging and development

- Synthetic data by default. Do not copy production databases, exports,
  webhook bodies, labels, support cases or screenshots.
- If an exceptional production-derived dataset is ever proposed, require a
  documented necessity, privacy/legal approval, minimisation/anonymisation,
  isolated access and disposal evidence before transfer.
- Staging roles and secrets remain distinct from production; a successful
  staging access review is not production approval.

### Backup and restore

- A backup inherits the highest classification of its contents.
- Restore into isolation with outbound jobs and provider calls disabled.
- Reapply post-backup erasure, rectification, restriction and suppression state
  before release, then reconcile financial/fulfilment state.
- Failed or ambiguous replay blocks release and may require incident assessment.

## Provider and service-identity access

- Approve every provider under
  `PROCESSOR-DUE-DILIGENCE-AND-DPA-CHECKLIST.md` and maintain a field/purpose
  allowlist for its integration.
- Credentials are unique by provider, environment and purpose; never share a
  human login with an application.
- Service identities cannot browse arbitrary customer records, create manual
  refunds or export data unless that exact machine purpose is approved.
- Webhook identity permits event submission only; it does not grant operations
  access.
- Provider support access is requested per case, time-bounded where supported
  and recorded without copying private support content into source control.
- Subprocessor access follows the approved data flow and contract, not an
  informal assumption that the primary provider's role covers every use.

## Export, screenshot and local-copy controls

Before creating a copy, establish purpose, minimum fields, recipient role,
storage location, encryption, expiry and owner.

- Use system-generated allowlisted exports; never `SELECT *` or provider “all
  data” exports for routine work.
- Prefer references and aggregate counts in tickets, incidents and approvals.
- Screenshots are evidence only when necessary; crop/redact unrelated content,
  store in the restricted evidence system and set a disposal/review time.
- Do not use personal email, consumer cloud storage, USB media, clipboard
  history, unrestricted AI/chat tools or repository attachments for commerce
  data.
- Delete temporary local copies after the approved task and retain outcome
  evidence, not the customer dataset.
- Unexpected personal data or credentials in an export/log is a potential
  incident and must be contained and escalated.

## Emergency or break-glass access

Emergency access is for containment or recovery where the normal interface
cannot safely perform the necessary action. It must have:

1. a declared incident/case and purpose;
2. named incident authority and, where possible, pre-approval;
3. minimum role/scope and automatic or prompt expiry;
4. strong authentication through a separate controlled path;
5. start/end times and tamper-resistant activity evidence;
6. no bulk export unless specifically authorised;
7. credential rotation/revocation where relevant; and
8. independent review by the next working review point.

Break-glass access must not be used to bypass normal refund, fulfilment, DSR or
release approval. If the evidence mechanism fails, preserve containment and
escalate rather than treating the access as unaudited permission.

## Access lifecycle and review

### Grant

- Approved role, business purpose, environment, permissions, duration and
  owner/deputy are recorded.
- Requester and approver are different for privileged access where practicable.
- MFA and recovery arrangements are verified before activation.

### Change

- Reassess on role, provider, system, employment/contract or duty change.
- Remove old rights before adding incompatible new authority.
- Never clone a predecessor's account or share credentials.

### Revoke

- Revoke immediately on departure, compromise or loss of purpose.
- Disable sessions/tokens, rotate shared dependencies if any, transfer owned
  cases and preserve audit evidence.

### Review

Use a risk-based schedule with more frequent privileged and provider/service
identity review. Verify actual use, dormant access, role conflicts, MFA,
tokens/keys, deputies and emergency grants. Record role/date/outcome without
publishing identities in this repository.

Event-driven review is mandatory after an incident, provider change, new data
category, new environment, material feature, failed audit, prolonged absence or
change to law/policy.

## Audit and monitoring

For restricted/highly restricted data, record the minimum necessary:

- verified actor/service identity and assumed role;
- UTC time, action, target internal entity reference and outcome;
- case/command/correlation reference;
- approval reference for high-risk operations;
- bounded before/after state or safe change summary; and
- export destination class and disposal trigger where applicable.

Do not log values changed, response packages, credentials, addresses, provider
payloads or free-form customer content merely to prove an action occurred.
Alert on repeated denied access, bulk/broad queries, unusual export, privileged
grant, break-glass activation, audit-control change and failed high-risk action.

## Implementation requirements

Before production:

- server-side permissions must map verified identities to purpose-specific
  operations and field-level views;
- customer-facing, operations and provider/service identities remain separate;
- each mutation is an authenticated, authorised, idempotent domain command
  rather than direct client/database state change;
- database/application roles prevent routine consoles and runtimes from having
  unnecessary DDL, ownership or cross-environment rights;
- exports enforce field allowlists, row/date bounds, no-store delivery and
  semantic audit;
- restricted states and legal/privacy holds are machine-enforceable;
- privileged grant/revoke and break-glass paths are tested; and
- negative tests prove every role cannot perform actions outside the matrix.

Future PostgreSQL and Mollie appendices must map concrete roles, API scopes,
dashboard permissions and tested denials to this model. They do not alter the
classification or governance baseline.

## Launch gates

- [ ] Accountable role owners/deputies and private assignments approved.
- [ ] Classification/data inventory reviewed by privacy, security and business owners.
- [ ] Every implemented permission maps to one matrix purpose and bounded operation.
- [ ] Field-level/minimised views tested for support, finance and fulfilment.
- [ ] High-risk action approvals and separation controls tested.
- [ ] Production/staging/service identity and credential separation verified.
- [ ] Export, screenshot, temporary-copy and disposal controls approved.
- [ ] Break-glass grant, expiry, evidence and review exercise passed.
- [ ] Joiner/mover/leaver and periodic access review procedures tested.
- [ ] Provider access and subprocessors match approved data flows/contracts.
- [ ] PostgreSQL, Mollie and selected fulfilment/shipping mappings validated.
- [ ] Independent negative-permission test evidence retained.

## Related controls

- `COMMERCE-ACCESS-AND-SECRETS-REVIEW.md`
- `COMMERCE-DATA-MODEL.md`
- `CUSTOMER-SUPPORT-OPERATIONS.md`
- `DATA-SUBJECT-RIGHTS-OPERATIONS.md`
- `DATA-SUBJECT-RIGHTS-REGISTER-SPECIFICATION.md`
- `LOGGING-AND-EXPORT-DATA-BOUNDARIES.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `PROCESSOR-DUE-DILIGENCE-AND-DPA-CHECKLIST.md`
- `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`
- `PRODUCTION-OWNERSHIP-AND-DEPUTY-APPOINTMENT-PACK.md`
- `SHIPPING-PRIVACY-AND-SECURITY.md`
