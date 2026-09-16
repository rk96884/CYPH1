# Data-subject rights operations

**Status:** Pre-production operating baseline; privacy/legal approval, named
owners, secure case system and technical controls outstanding  
**Production commerce:** Disabled  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Define how CYPH/1 recognises, verifies, coordinates and closes requests for
access, rectification, erasure, restriction, objection and related rights.
This provider-neutral procedure remains the baseline when payment, database,
marketing, support and shipping providers change.

This document is not legal advice and does not approve a lawful basis,
retention period, exemption, identity method, response template or deletion
command. An authorised current-law privacy/legal owner must approve those
before live commerce. Do not put real request records or personal data in this
repository.

## Non-negotiable rules

- Recognise a request by its substance; it need not mention UK GDPR or use a
  particular channel.
- Record every right engaged by one message without forcing separate requests.
- Stop direct marketing promptly and independently from commerce erasure;
  preserve only an approved minimal suppression record.
- Verify identity only where there is reasonable doubt and only to the degree
  proportionate to the disclosure or action risk.
- Do not confirm that a person, order or account exists before identity is
  sufficiently established.
- Do not request passwords, full card details, security codes, API credentials
  or collection codes. Identity documents are not the default.
- Search by purpose and system; do not paste customer data into GitHub,
  unrestricted chat, ordinary alerts or uncontrolled spreadsheets.
- Correct reusable inaccurate data without rewriting an accurate historical
  record of a past transaction.
- Treat restriction as an enforceable processing state, not merely a case note.
- Erasure is category- and field-specific. Neither “customer record” nor
  “financial record” is a blanket retention decision.
- Never use ad-hoc SQL, cascade deletion or provider-dashboard edits to repair a
  rights request.
- A processor delay does not become CYPH/1's deadline.
- Keep backup data beyond ordinary use where immediate alteration is not
  feasible, and prevent restoration from resurrecting superseded privacy state.

## Required roles and authority

The restricted ownership register must appoint a primary and deputy for:

| Role | Authority |
| --- | --- |
| Request coordinator | Intake, deadline control, safe acknowledgement, task coordination and closure record |
| Privacy/legal decision owner | Rights interpretation, exemptions/refusals, restriction and erasure decision approval |
| Finance/record-retention owner | Tax/accounting necessity and category-specific retention evidence |
| Support/commerce owner | Operational customer, order, return, warranty and claims facts |
| Technical system owner | Approved search, export, correction, restriction, deletion and restore controls |
| Processor/vendor owner | Contract route, scoped instruction, deadline escalation and confirmation |
| Independent reviewer | Disclosure review, high-risk decision check and completion assurance |

One person may perform several roles initially, but technical access does not
grant legal decision authority. Missing decision authority or deputy cover is a
launch blocker and a deadline-risk escalation.

## Case lifecycle

Use only these case states:

```text
RECEIVED
VERIFYING
VERIFIED
SEARCHING
ASSESSING
ACTIONING
PROCESSOR_PENDING
RESPONSE_READY
RESPONSE_SENT
TECHNICAL_ACTIONS_CONFIRMED
CLOSED
```

`ON_HOLD` is not a substitute for a state. Record a bounded hold reason,
owner, review time and affected actions alongside the current state. A case
cannot be `CLOSED` merely because a response was sent.

## 1. Intake and recognition

1. Preserve the original request in the approved restricted case system.
2. Create a non-personal case reference and record receipt time/channel.
3. Identify each right or request raised: access, rectification, erasure,
   restriction, objection/direct marketing, portability or another concern.
4. Record the applicable deadline and an earlier internal target. Current ICO
   guidance normally uses one calendar month, subject to the specific right,
   proportionate identity information and any lawfully justified extension.
5. Assign the coordinator and required decision owners.
6. Action direct-marketing withdrawal for the address/channel making the
   objection without using an unverified claim to alter another person's
   record.
7. Send a safe acknowledgement that describes process and verification needs
   without confirming record existence.

Any suspected wrongful disclosure, account takeover or unsafe delivery of a
response also follows `PERSONAL-DATA-INCIDENT-ESCALATION.md`.

## 2. Identity verification

### Decision framework

| Question | Required treatment |
| --- | --- |
| Is identity already sufficiently established through an approved authenticated channel? | Do not collect more evidence merely by habit |
| Is there reasonable doubt? | Record why and request the minimum additional information needed promptly |
| Could the requested action disclose or materially alter sensitive order, payment, address or account data? | Increase assurance proportionately |
| Are proposed facts available on packaging, emails, public pages or to another household member? | Do not treat them automatically as independent factors |
| Is the original channel unavailable? | Use an approved alternate path; do not reveal which answer failed or whether a record exists |
| Is formal evidence genuinely necessary? | Request the minimum, permit safe redaction where appropriate, protect it and delete it under an approved short retention rule |

Record verification method class, outcome and time—not secret answers or an
unnecessary identity-document copy. If identity cannot be established, explain
why CYPH/1 cannot safely progress the affected action and give the applicable
complaint route. Retain the original receipt date and record separately how the
current guidance affects the compliance deadline.

## 3. Search plan and data inventory

After verification, create a scoped search matrix from the approved data
inventory. Each row records system/purpose, identifier types, owner, result,
processor dependency and evidence reference—not a copy of the matched data.

Minimum locations to assess where applicable:

- early-access, marketing, consent and suppression records;
- commerce customer/profile and reusable addresses;
- immutable order, price, tax and delivery snapshots;
- payment, refund, reconciliation and dispute records;
- fulfilment, shipment, tracking and collection-point records;
- transactional communications and delivery events;
- support, return, warranty, safety and incident cases;
- controlled exports and approved local evidence copies;
- processor and recipient records; and
- archives/backups, including whether retrieval is feasible and proportionate.

Use controlled exports or views with explicit field allowlists. Do not modify
source records to prepare an access response, and do not place a blanket hold
on every matched record. Any preservation must be necessary, scoped, owned and
time-limited.

## 4. Assessment by right

### Access

- Provide the person's personal data in an intelligible, commonly used form
  plus the required supplementary information.
- Review third-party data, confidentiality, exemptions and security-sensitive
  material. Redact narrowly where possible rather than withholding an entire
  record without assessment.
- Never disclose password hashes, keys, tokens, session material or information
  that would unjustifiably weaken security.
- Record every exclusion/redaction category and authorised rationale.

### Rectification

- Take reasonable steps to assess accuracy for the data's purpose.
- Correct current reusable inaccurate data and notify applicable recipients.
- Preserve an accurate historic snapshot of what happened; add approved context
  or supplementary information rather than rewriting history.
- Restrict disputed data as required while accuracy is assessed.

### Restriction

- Confirm an applicable restriction ground for each affected category.
- Mark the data through an approved enforceable control and prevent ordinary
  use, alteration, secondary analytics or marketing as applicable.
- Permit only processing authorised under the restriction decision.
- Notify applicable recipients and tell the individual before lifting a
  restriction where required.

### Erasure

For every category, record exactly one proposed outcome:

- erase;
- anonymise under an approved irreversible method;
- retain under a specific documented obligation or permitted purpose;
- restrict pending a bounded decision; or
- no matched data.

Every retained category needs the data/fields required, purpose, authority,
retention trigger, period/review date and decision owner. An open refund,
dispute, return, warranty, incident or legal hold must be real, scoped and
reviewed—not assumed. Irreversible action requires approved tooling and the
authorised privacy/legal and, where relevant, finance decision.

### Direct-marketing objection

- Stop direct marketing without waiting for the other rights analysis.
- Propagate suppression to applicable channels/processors.
- A later purchase, import or backup restore must not reinstate marketing.
- Keep only the approved minimum suppression data for the approved period.

## 5. Processor and recipient handling

Maintain a provider appendix outside this baseline for each live service. It
must identify role (processor/controller/recipient), contract route, verified
contact, response expectation, supported rights, backup behaviour and evidence
format.

Approve the provider and its evidence under
`PROCESSOR-DUE-DILIGENCE-AND-DPA-CHECKLIST.md` before it receives production
personal data.

A scoped processor instruction must contain only necessary identifiers and:

1. case reference and controller instruction;
2. systems and data scope;
3. required search, correction, restriction or erasure action;
4. due time earlier than CYPH/1's deadline;
5. residual copies and backup treatment requested;
6. completion evidence required; and
7. an escalation route for inability, delay or ambiguity.

The processor does not decide CYPH/1's retention rule or communicate the final
controller response unless a formally approved arrangement says otherwise.
Notify other recipients of rectification, erasure or restriction where current
law requires it, and record any authorised exception.

## 6. Deadline and escalation control

- Display the statutory deadline, internal target and next action on every
  active case view without putting personal data in alert text.
- Escalate at intake if ownership is missing; otherwise use documented early
  warning points rather than waiting until the final days.
- A complexity extension is exceptional, case-specific and authorised. Where
  permitted, notify the individual within the original period, explain why and
  state the revised deadline. Do not extend solely because a processor is slow.
- If a deadline is threatened or missed, escalate immediately, continue the
  work, communicate accurately and record the cause/remediation. Do not alter
  dates or close the case administratively.

## 7. Response preparation and secure delivery

1. Reconcile the search matrix, decisions, actions and unresolved dependencies.
2. Independently review the response pack, supplementary information,
   redactions and delivery recipient/channel.
3. Use an approved authenticated, time-limited delivery method. Do not send a
   password in the same channel as its protected file.
4. Use a neutral subject and avoid personal, order, payment, address or tracking
   data in notification text.
5. State completed actions, category-specific retained data and reasons,
   restriction status, processor/backup limitations, outstanding execution and
   applicable complaint/enforcement routes.
6. Do not say data is erased, corrected or delivered until evidence supports
   that statement.

## 8. Backup and restore protection

Where granular backup alteration is not feasible, residual data must be
encrypted, access-restricted, beyond ordinary use and removed through the
approved backup lifecycle. Record the applicable backup class and expiry/control
evidence without copying the underlying personal data.

Before any restored environment enters ordinary use:

```text
restore into isolation
→ identify privacy decisions after the restore point
→ replay correction, erasure, restriction and suppression state
→ verify every applicable result
→ obtain release approval
```

Any failure or ambiguity is fail-closed: keep the environment isolated, stop
outbound processing, escalate to technical and privacy owners, reconcile and
rerun. If data escaped isolation, invoke the personal-data incident procedure.

## 9. Closure

Close only when:

- identity and rights handling are recorded;
- all applicable systems/processors were searched or a documented authorised
  limitation is recorded;
- the response was reviewed and securely delivered;
- correction, restriction, erasure and suppression actions are confirmed;
- retained categories have approved reasons and review/expiry triggers;
- processor and backup residuals have owners and controls;
- temporary response/export copies were deleted or assigned an approved hold;
- complaint routes and any required follow-up were communicated; and
- an independent reviewer confirms the privacy-safe evidence is sufficient.

Customer silence, a sent email or an issued processor instruction is not case
completion.

## Required provider appendices

Add appendices only when the provider/account is selected and validated:

- Render/PostgreSQL search, correction, restriction, erasure and restore replay;
- Mollie access, payment-record retention, correction/erasure boundaries and
  verified rights route;
- Brevo consent, suppression, contact/event/log deletion and backup behaviour;
- Cloudflare request/security log access, retention and deletion boundaries;
- shipping/fulfilment provider tracking, collection-point, proof and deletion;
  and
- approved support/case and secure response-delivery systems.

Appending provider controls does not require repeating the provider-neutral
tabletop. Provider-specific technical tests must still be run once those
systems exist.

## Launch gates

- [ ] Primary/deputy roles and decision authorities appointed and tested.
- [ ] Restricted case system and register access approved.
- [ ] Retention schedule, exemptions and evidence-retention rule approved.
- [ ] Identity methods and safe alternate-channel flow tested.
- [ ] Data inventory and provider appendices completed.
- [ ] Secure disclosure preparation, review and delivery tested.
- [ ] Technical correction, restriction, erasure and suppression controls tested.
- [ ] Processor assistance, deadlines and completion evidence validated.
- [ ] Isolated backup restore and privacy-state replay passes fail-closed test.
- [ ] Requester communications and refusal/extension wording approved.
- [ ] Accountable privacy/legal owner signs launch evidence.

## Current-law references

- [ICO: Individual rights guidance and resources](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/)
- [ICO: Subject access response considerations](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/)
- [ICO: Right to rectification](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-rectification/)
- [ICO: Right to erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)
- [ICO: Right to restrict processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-restrict-processing/)
- [ICO: Right to object](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-object/)

Check current guidance before handling a live request; cited ICO guidance may be
updated following changes to UK data-protection law.

## Related procedures

- `DATA-SUBJECT-RIGHTS-REGISTER-SPECIFICATION.md`
- `DATA-SUBJECT-RIGHTS-TABLETOP.md`
- `CUSTOMER-DATA-RETENTION-AND-DELETION.md`
- `CUSTOMER-SUPPORT-OPERATIONS.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `PROCESSOR-DUE-DILIGENCE-AND-DPA-CHECKLIST.md`
- `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`
