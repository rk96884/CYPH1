# Production ownership and deputy appointment pack

**Status:** Provider-neutral appointment framework; no person is appointed by
this document  
**Production commerce:** Disabled  
**Last engineering update:** 16 September 2026

## Purpose and privacy boundary

Turn the role framework in
`PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md` into explicit, accepted and
tested production appointments.

This repository stores the appointment process and privacy-safe completion
evidence only. The approved restricted governance system must hold names,
personal/business contact routes, availability, account identifiers, MFA and
recovery details, provider support references, signatures and private
escalation paths.

Do not use GitHub issues/projects, ordinary chat, public calendars or this file
as the live ownership register. Completing a blank form in source control does
not appoint anyone.

## Appointment principles

- A title does not grant authority or system access.
- Access does not grant decision authority.
- Silence, availability or historical project involvement is not acceptance.
- Every critical primary needs an expressly authorised deputy who can act
  without the primary's account, device or permission at the time of need.
- A deputy is not coverage unless the relevant access and decision path has
  been tested.
- One person may hold several roles at small initial scale, but conflicts and
  independent-review requirements must be recorded and mitigated.
- No one independently approves their own high-risk action, access grant or
  recovery evidence.
- Published support/availability commitments must match actual accepted
  coverage. Do not invent 24/7 service.
- Appointment, access, contact and recovery data is itself restricted and has
  an approved retention/review rule.
- Removal, prolonged absence or authority change triggers immediate handover
  and access review.

## Required appointment set

| Appointment | Minimum deputy/independence requirement | Core authority |
| --- | --- | --- |
| Executive launch owner | Named alternate for absence; cannot waive mandatory legal/security/payment-integrity gates | Accept residual business risk and authorise controlled enablement after applicable sign-offs |
| Commerce incident commander | Expressly authorised deputy | Declare/coordinate incidents, containment, owners and staged recovery |
| Technical operations primary | Independent technical deputy with tested access | Disable/recover runtime, inspect bounded evidence and run verification |
| Customer-support primary | Customer-support deputy with approved channel/case access | Own customer cases, approved updates and specialist handoffs |
| Privacy/legal decision owner | Expressly authorised privacy/legal deputy | Rights, breach notification, privacy communications and privacy-duty closure decisions |
| Finance/reconciliation owner | Deputy or documented coverage appropriate to payment/refund/dispute deadlines | Settlement, refund accounting, reconciliation and payment evidence decisions |
| Fulfilment/shipping owner | Deputy or documented coverage appropriate to dispatch/claim deadlines | Dispatch, cancellation, return, carrier and fulfilment recovery decisions |
| Product-safety/compliance owner | Independent authorised alternate and defined urgent route before product sale | Immediate safety response, evidence preservation and regulatory/product decisions |
| Security/incident evidence owner | Independent reviewer/alternate for privileged evidence and access incidents | Security containment, restricted evidence and access-integrity assessment |
| Database/backup recovery owner | Independent verifier; may be part of technical role but verification cannot be self-approved | Restore, reconciliation and privacy-state replay execution |

The accountable launch owner decides whether additional roles are needed for
the final product, provider chain, insurance, tax/accounting, 3PL, complaints or
regulated obligations. Missing critical coverage keeps the affected capability
disabled.

## Appointment lifecycle

```text
DRAFT
→ CANDIDATE_REVIEW
→ AUTHORITY_DEFINED
→ CONFLICT_REVIEWED
→ ACCEPTED
→ ACCESS_VERIFIED
→ DEPUTY_PATH_TESTED
→ ACTIVE
→ REVIEW_DUE / SUSPENDED
→ HANDOVER
→ REVOKED_AND_ARCHIVED
```

Only `ACTIVE` appointments satisfy launch coverage. `ACCESS_VERIFIED` without
acceptance or a tested deputy is not active. A suspended or expired appointment
cannot authorise production action.

## Pack A — role appointment record

Copy this into the approved restricted governance system for each primary and
deputy:

```text
Appointment record ID:
Role title:
Primary or deputy:
Person / employment or contractor relationship:
Appointment scope and environments:
Effective date/time:
Coverage period, timezone and known limits:
Required monitored/acknowledgement periods:
Reports/escalates to:
Paired primary/deputy record:
Appointing authority:
Restricted contact-record reference:
Access-verification record reference:
Conflict/separation review reference:
Exercise evidence reference:
Retention/review rule:
Next review date:
Status:
```

Do not appoint a supplier support desk as CYPH/1's accountable owner. A
provider route supports the appointed CYPH/1 role.

## Pack B — authority and decision-boundary acceptance

The appointee must acknowledge each item explicitly:

```text
I understand and accept:
[ ] the decisions I am authorised to make;
[ ] the decisions I must escalate or obtain independent approval for;
[ ] the systems/data I may access and only for which purposes;
[ ] that I must not use direct SQL/provider edits to manufacture business state;
[ ] the incidents, deadlines and absences I must report immediately;
[ ] the approved primary/deputy activation and handover process;
[ ] the evidence I must create without copying customer data or secrets;
[ ] the limits of published customer/service commitments;
[ ] the requirement to preserve privacy, security, payment and safety duties;
[ ] that access/authority ends when the appointment is suspended or revoked.

Accepted by:
Accepted at:
Appointment/version accepted:
Appointing authority approval:
```

### Role-specific authority schedule

Attach a schedule containing:

- permitted declarations, approvals and commands;
- mandatory consultations and independent approvals;
- monetary, data-volume, environment and time limits;
- explicit prohibitions;
- incident/severity triggers;
- regulator, insurer, provider and customer communication authority;
- alternate-system authority; and
- conditions that require the capability to remain or become disabled.

Reference the access-control matrix rather than reproducing or expanding its
maximum authority. A private schedule can narrow access; it cannot exceed
`COMMERCE-DATA-CLASSIFICATION-AND-ACCESS-CONTROL.md` without reviewed source
control and governance changes.

## Pack C — private contact and coverage record

Store only in the restricted register:

```text
Appointment record ID:
Approved work contact route(s):
Urgent acknowledgement route:
Fallback route and order:
Timezone:
Normal monitored periods:
Out-of-hours / holiday coverage:
Planned absence notification lead time:
Unplanned absence detection and escalation:
Accessibility or contact constraints volunteered for operational use:
Provider/regulator/insurer route references needed by this role:
Alternate-system contact route:
Last acknowledgement test / result:
Next contact verification:
```

Collect only operationally necessary information. Do not require a personal
telephone number or private address merely because the organisation is small;
approve proportionate business/contact arrangements.

## Pack D — system and access verification

Complete separately for primary and deputy. Do not record secret values,
recovery codes or raw assertions.

| Verification | Required evidence |
| --- | --- |
| Identity/account | Unique approved identity; no shared human account |
| Role/permission | Exact environment and least-privilege grant mapped to the access-control matrix |
| MFA | Enabled and exercised; method/recovery class and review date, not secret material |
| Alternate access | Person can reach essential runbooks/case contacts if the primary email, GitHub or normal system is unavailable |
| Provider consoles | Only providers required by the role; test/live and human/service identities separated |
| Protected application | Positive allowed action and negative prohibited-action tests using synthetic records |
| Emergency access | Break-glass request, expiry, logging and review path understood/tested where applicable |
| Audit visibility | Appointee or reviewer can locate privacy-safe evidence of their action |
| Revocation | Owner and tested/verified method for rapid disable/session/token handling |

Record:

```text
Access-verification ID:
Appointment record ID:
Environment/system:
Expected permission/purpose:
Grant owner/approver:
Positive test/result/date:
Negative test/result/date:
MFA/recovery readiness result/date:
Alternate-access result/date:
Evidence reference:
Exceptions/expiry:
Independent reviewer:
Overall result:
```

A screenshot of a dashboard role is not sufficient alone. Verify that the
intended operation succeeds and at least one prohibited operation fails without
using live customer data or causing a provider side effect.

## Pack E — conflict and separation-of-duty review

For every person holding multiple roles, assess:

- ability to initiate and approve the same refund, deletion, export or restore;
- ability to change code/configuration and independently approve its production
  recovery;
- ability to decide a privacy notification and control the evidence presented;
- ability to approve a product-safety outcome and dispose of relevant evidence;
- ability to grant their own privileged access or suppress its audit;
- financial/reconciliation authority combined with payment-provider control;
- primary/deputy dependency on the same account, device, email or person; and
- supplier/commercial interests that could affect an incident or claim decision.

Use one treatment:

| Treatment | Requirement |
| --- | --- |
| Separate | Assign another authorised person before activation |
| Prevent | Technical permission/workflow blocks self-approval |
| Limit | Reduce scope, amount, environment or duration |
| Independently review | Time-bounded action plus prompt reviewer evidence where prior separation is impracticable |
| Keep disabled | No safe mitigation currently exists |

Record the conflict, risk, treatment, owner, implementation evidence, expiry and
reviewer. “Small team” explains the constraint; it does not close the risk.

## Pack F — deputy activation and handover

### Planned absence

1. Primary identifies open cases, deadlines, incidents, provider changes and
   scheduled releases without copying customer data into the handover summary.
2. Deputy confirms availability, authority, current access and private contact
   routes.
3. Both record the activation window and which authority transfers.
4. Alert/support/provider routing is changed through approved configuration.
5. Primary's standing access is not shared; suspend only if policy/risk requires.
6. Deputy acknowledges each critical item and next action.
7. On return, reconcile actions and formally end the handover.

### Unexpected unavailability

1. Detect a missed acknowledgement through the approved coverage rule—not
   informal assumption.
2. Attempt the documented primary routes once in the approved order.
3. Activate the deputy and record time, triggering condition and authority.
4. Escalate to the executive/private fallback if deputy acknowledgement fails.
5. Keep the affected capability disabled where no authorised decision owner is
   available.
6. Review the activation after recovery without penalising safe escalation.

### Handover record

```text
Handover ID:
Role / primary / deputy appointment references:
Planned or unexpected:
Start and expected end:
Activation trigger:
Authority transferred:
Open critical case/incident references:
Deadlines and next actions:
Routing/configuration changes:
Access exceptions:
Deputy acknowledgement:
End/reconciliation time:
Independent review and findings:
```

## Pack G — primary-unavailable exercise

**Exercise ID:** `OWN-DRILL-001`  
**Status:** Prepared; not yet run  
**Safety:** Synthetic identifiers only. Do not contact customers, regulators,
insurers or provider emergency routes; do not create payments, refunds,
shipments, deletions or production configuration changes.

### Objectives

Prove that:

1. a missed primary acknowledgement is detected through the approved rule;
2. the correct deputy receives the alert through an independent route;
3. the deputy can reach runbooks, restricted contacts and required systems
   without the primary's device/session;
4. the deputy understands the same authority and prohibitions;
5. payment, privacy, safety and technical decisions remain with the correct
   roles;
6. an unavailable primary does not cause silent approval or unsafe action; and
7. routing returns cleanly after the exercise.

### Scenario sequence

1. Simulate one customer-runtime alert and one operations alert; mark the
   primary unavailable.
2. Apply the approved acknowledgement window and activate the deputy.
3. Present a synthetic ambiguous payment. Support must avoid an outcome promise;
   finance/reconciliation owns the payment conclusion.
4. Present a synthetic suspected personal-data breach. Technical containment
   continues, but only the privacy/legal primary or authorised deputy makes the
   notification decision.
5. Present a synthetic product-safety report. Support escalates and uses no
   unapproved safety wording or remedy promise.
6. Require one alternate-system access path without revealing credentials or
   calling a live provider emergency route.
7. End the activation, reconcile synthetic actions and restore routing.

### Pass criteria

- primary timeout and deputy activation followed the approved rule;
- deputy access and one prohibited negative permission were demonstrated;
- no role exceeded its decision authority;
- no live customer/provider/regulatory action or real personal data was used;
- missing owner/access/contact/coverage was recorded as a launch blocker;
- evidence contains appointment/exercise references, roles, UTC times,
  pass/fail outcomes and remediation only; and
- failed checkpoints are repeated after remediation before launch.

### Privacy-safe source-control record

Complete this section only after the private exercise record is approved:

```text
Exercise ID: OWN-DRILL-001
Exercise date:
Roles exercised:
Primary treated as unavailable: yes/no
Deputy activated through independent route: yes/no
Access verified without primary dependency: yes/no
Negative permission passed: yes/no
Payment authority preserved: yes/no
Privacy/legal authority preserved: yes/no
Product-safety authority preserved: yes/no
Alternate-system path verified: yes/no
Live systems changed or real data used: no
Result: not yet assessed
Open blockers:
Accountable reviewer role/date:
```

Do not record names, contact details, accounts, acknowledgement timestamps that
reveal personal schedules, or provider emergency references here.

## Pack H — periodic review, suspension and revocation

Review at a risk-based interval and immediately on:

- joiner/mover/leaver, contract or responsibility change;
- planned/prolonged absence or repeated missed acknowledgement;
- new provider, environment, product, market or regulated duty;
- incident, unsafe action, failed exercise or access anomaly;
- material policy, legal, coverage or customer commitment change;
- role conflict or loss of independent deputy coverage; or
- compromise/loss of an account, MFA or recovery method.

Review acceptance, current authority, access use, MFA/recovery readiness,
contacts, deputies, conflicts, exercises, open cases and published commitments.

For suspension/revocation:

1. set appointment status and effective time;
2. activate authorised coverage or disable the affected capability;
3. revoke access, sessions, provider roles and recovery authority;
4. rotate any shared dependency that should not exist but is affected;
5. transfer cases, deadlines, evidence and provider ownership;
6. confirm routing/alerts no longer depend on the former appointee;
7. preserve minimal audit evidence and apply the approved retention rule; and
8. independently verify completion.

## Portfolio completion register

Source control may record this role-level evidence after private records are
approved. Do not add names or contact details.

| Role | Primary accepted | Deputy accepted | Access verified | Deputy exercise | Conflict review | Next review | Launch status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Executive launch | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Incident command | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Technical operations | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Customer support | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Privacy/legal | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Finance/reconciliation | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Fulfilment/shipping | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Product safety/compliance | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Security/incident evidence | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |
| Database/backup recovery | [ ] | [ ] | [ ] | [ ] | [ ] |  | Blocked |

Do not tick a box from an informal conversation. Every mark references an
approved private record and, where applicable, test evidence.

## Launch gates

- [ ] Restricted governance/contact/access registers selected and protected.
- [ ] Every required primary and deputy explicitly accepted current authority.
- [ ] Coverage and published support commitments are realistic and approved.
- [ ] Role conflicts and independent-review mitigations are approved.
- [ ] Primary and deputy access pass positive and negative synthetic tests.
- [ ] MFA, recovery and alternate-system access are verified independently.
- [ ] Provider, regulator, insurer and internal escalation routes are current.
- [ ] Joiner/mover/leaver, suspension, handover and revocation are tested.
- [ ] `OWN-DRILL-001` passes with privacy-safe evidence.
- [ ] Failed checkpoints are remediated and repeated.
- [ ] Accountable launch owner signs the private portfolio record.

Production checkout and related live-provider processing remain disabled while
any applicable role is blocked.

## Related controls

- `COMMERCE-ACCESS-AND-SECRETS-REVIEW.md`
- `COMMERCE-DATA-CLASSIFICATION-AND-ACCESS-CONTROL.md`
- `COMMERCE-INCIDENT-OWNERSHIP.md`
- `CUSTOMER-SUPPORT-OPERATIONS.md`
- `DATA-SUBJECT-RIGHTS-OPERATIONS.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`

