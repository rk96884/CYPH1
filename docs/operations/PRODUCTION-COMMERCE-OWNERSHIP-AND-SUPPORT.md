# Production commerce ownership and customer-support plan

**Status:** Governance framework prepared; named appointments and accountable approval outstanding  
**Production commerce:** Disabled  
**Last engineering update:** 15 September 2026

## Purpose

Define the minimum decision ownership, backup coverage and customer-support
handoffs required before CYPH/1 accepts orders. This document assigns
responsibilities to roles only. Names, personal contact details, provider
account identifiers and out-of-hours routes belong in a restricted operational
register and must not be committed to this repository.

This framework does not appoint an individual, create an employment duty or
approve a service level. Each role and deputy must explicitly accept the scope
in the restricted register before the corresponding launch gate can close.

Create, accept, verify and review each appointment using
`PRODUCTION-OWNERSHIP-AND-DEPUTY-APPOINTMENT-PACK.md`. A role is not active
merely because a candidate has access or is named informally.

Role titles in this plan grant no data access by themselves. Implemented
permissions and high-risk separation must remain within
`COMMERCE-DATA-CLASSIFICATION-AND-ACCESS-CONTROL.md`.

## Required roles and decision authority

| Role | Required authority | Cannot delegate informally |
| --- | --- | --- |
| Commerce incident commander | Declare an incident, coordinate containment, assign actions and approve staged technical recovery | Privacy notification, financial settlement or unsafe database changes |
| Technical operations primary | Disable checkout, preserve verified webhooks where safe, inspect bounded logs, recover Render/Cloudflare services and run verification | Editing order/payment state directly or declaring a payment outcome |
| Independent technical deputy | Assume technical command when the primary is unavailable and independently verify recovery | Acting as a nominal contact without tested account access |
| Customer-support owner | Own the customer case, approved status updates and handoff to operations | Promising refunds, dispatch or outcomes before authoritative confirmation |
| Customer-support deputy | Maintain case coverage during absence and verify access to the approved support channel | Using personal accounts or unapproved exports |
| Privacy/legal decision owner | Decide ICO and affected-person notification, approve privacy communications and closure of privacy duties | Delegating the formal decision to engineering by silence or absence |
| Privacy/legal deputy | Exercise the same expressly delegated authority during absence or out of hours | Merely relaying messages without decision authority |
| Finance/reconciliation owner | Approve settlement, refund-accounting and reconciliation decisions | Treating browser redirects or customer reports as payment evidence |
| Fulfilment owner | Approve dispatch, cancellation, return and provider recovery decisions | Dispatching without revalidated captured payment |
| Executive launch owner | Accept residual business risk and authorise controlled production enablement | Overriding unresolved legal, security or payment-integrity blockers |

One person may hold more than one primary role during an early controlled
launch, but the technical and privacy/legal deputy functions must not depend on
that same person's availability. A person cannot independently verify their own
high-risk recovery action.

## Incident decision model

| Event | Initial owner | Mandatory consultation | Final decision owner |
| --- | --- | --- | --- |
| Failed deploy or runtime outage | Technical operations | Incident commander | Incident commander for recovery sequence |
| Database unavailable or integrity uncertain | Technical operations | Incident commander; database owner | Incident commander after technical verification |
| Ambiguous payment or refund | Incident commander | Technical operations; finance/reconciliation | Finance/reconciliation for accounting; incident commander for checkout state |
| Fulfilment mismatch or unsafe retry | Fulfilment owner | Technical operations; customer support | Fulfilment owner after payment revalidation |
| Suspected personal-data breach | Incident commander | Privacy/legal; technical operations | Privacy/legal for notification; incident commander for containment |
| Customer safety allegation or reportable product issue | Customer-support owner | Executive launch owner; legal/compliance; fulfilment as relevant | Approved legal/compliance or executive owner |
| Re-enable production checkout | Incident commander | Technical, finance, support and affected specialist owner | Executive launch owner after every applicable gate passes |

Silence, an unanswered message or the absence of a primary is not approval. The
appointed deputy assumes the recorded authority; if neither is available, keep
the affected capability disabled and escalate through the restricted executive
route.

## Customer-support operating boundary

Before launch, approve and test one official customer-facing support channel
published in the website's contact and policy pages. The support workflow must:

1. create a case reference without exposing order or personal data in its subject;
2. verify the requester using an approved proportionate method before revealing
   order details or changing an address;
3. distinguish general enquiries, order status, cancellation, return, refund,
   payment ambiguity, privacy rights and security/safety reports;
4. record consent-independent transactional contact separately from marketing;
5. use the protected operations interface and provider evidence rather than
   asking for full payment credentials or relying on screenshots;
6. escalate suspected duplicate charges, missing refunds, unauthorised access,
   safety reports and personal-data incidents immediately;
7. avoid promising a refund, cancellation, delivery date or dispatch outcome
   until the authoritative workflow confirms it;
8. retain only the approved case data for the approved period; and
9. provide a clear closure message and preserve required financial, dispute,
   privacy or safety evidence.

Do not request card numbers, security codes, passwords, API keys or identity
documents through ordinary email or chat. Do not copy customer records into
GitHub issues, source control or unrestricted spreadsheets.

## Coverage and escalation worksheet

The accountable launch owner must approve these values in the restricted
register. They remain intentionally blank here because staffing and service
commitments have not been agreed.

| Decision | Required private-register value |
| --- | --- |
| Published support channel and monitored hours | Address/channel, timezone, business hours and holiday coverage |
| Primary and deputy acknowledgement method | Approved contact routes and fallback order |
| Severity definitions | Customer, payment, privacy, fulfilment and availability impact criteria |
| Acknowledgement targets | Target for each severity and coverage period |
| Customer update cadence | Owner, channel and frequency for active cases |
| Provider escalation routes | Render, Cloudflare, database, Mollie, fulfilment and communications contacts |
| Regulatory and insurer routes | Authorised ICO, legal, insurer and other applicable contacts |
| Alternate-system access | How responders work if email, GitHub, Render or the normal support system is unavailable |
| Handover and absence process | Planned leave, out-of-hours and unexpected-unavailability procedure |

Do not invent a 24/7 promise. The proposed launch scope and published support
language must match the coverage the appointed people can actually provide.

## Restricted ownership register

Maintain a non-public register containing, at minimum:

- role and scope;
- primary's name and approved contact routes;
- deputy's name and approved contact routes;
- explicit delegated decision authority;
- systems/accounts each person can access;
- MFA and recovery-access verification date;
- coverage period, timezone and handover rule;
- last acknowledgement test and outcome;
- approving owner and approval date; and
- next review date.

Access should be limited to people who need the contact and authority data. Keep
an approved alternate copy accessible when the primary identity, email or
source-control system is unavailable.

## Pre-launch verification exercise

Use synthetic identifiers only. Do not contact real customers or create a real
payment.

1. Trigger or simulate one customer-runtime alert and one operations alert.
2. Contact the primary through the approved private route and record the UTC
   acknowledgement time.
3. Repeat using the deputy while treating the primary as unavailable.
4. Present an ambiguous-payment scenario and verify support does not promise an
   outcome before finance/provider reconciliation.
5. Present a suspected personal-data event and verify technical containment
   continues while only the privacy/legal owner or authorised deputy makes the
   notification decision.
6. Confirm responders can reach the runbooks and required providers through the
   alternate-access method.
7. Record gaps, owners and due dates; repeat failed portions before launch.


## Production operations access evidence — 24 September 2026

A separate Render service, `cyph1-commerce-operations-production`, was deployed in Frankfurt from `main` using the commerce API operations runtime. It connects to the production PostgreSQL database while commerce, payment and fulfilment remain disabled.

The service is exposed through `operations.cyph1.co.uk` behind a dedicated Cloudflare Access self-hosted application named **CYPH1 Commerce Operations Production**. The existing named-operator-only Access policy is attached. The native application root was reached only after completing the Cloudflare Access authentication flow.

Application-level authorization is separately constrained by `OPERATIONS_ACCESS_GRANTS`. At this rehearsal the named production operator was granted only `orders:read` and `reconciliation:export`. The higher-risk `refunds:create` and `fulfilment:retry` permissions were not granted and were not exercised.

Two read-only production checks were completed through the authenticated custom-domain path:

- `GET /operations/orders` returned `{"orders":[]}`, demonstrating successful Cloudflare authentication, production Access audience validation, application grant recognition, the `orders:read` permission and a production PostgreSQL read.
- `GET /operations/reconciliation.csv` for a bounded September 2026 range returned the expected reconciliation column headings with no data rows, demonstrating the `reconciliation:export` permission while confirming the current production commerce dataset remained empty.

No order, payment, refund, fulfilment action or other commerce write was created by these checks. This evidence establishes the current primary operator's read-only production operations access. It does **not** satisfy the separate deputy-access, staffing, coverage, escalation or primary-unavailable approval gates below.

### Production operations direct-origin hardening — 24 September 2026

After the protected custom-domain access checks passed, the native Render subdomain for `cyph1-commerce-operations-production` was disabled to prevent that hostname from providing an alternate route around the Cloudflare Access boundary.

Post-change verification produced both required outcomes:

- the protected custom-domain request to `https://operations.cyph1.co.uk/operations/orders` continued to authenticate and returned the expected empty production order set; and
- the former native Render operations hostname returned **Not Found** when the operations orders path was requested.

This verifies that the intended Cloudflare-protected production operations route remains functional while the tested native Render direct-origin route is no longer available.

## Approval gates

- [ ] Incident commander and deputy appointed and accepted.
- [ ] Technical primary and independent deputy have tested production access.
- [ ] Customer-support primary/deputy, channel and coverage approved.
- [ ] Privacy/legal primary and expressly authorised deputy appointed.
- [ ] Finance/reconciliation and fulfilment owners appointed.
- [ ] Executive launch owner identified.
- [ ] Restricted ownership, processor and escalation registers created.
- [ ] Provider and alternate-system contacts verified.
- [ ] Severity, acknowledgement and customer-update commitments approved.
- [ ] Primary-unavailable exercise passed.
- [ ] Website support and policy wording matches the approved operating model.
- [ ] Accountable launch owner has signed the completed private record.

Production commerce must remain disabled until every applicable appointment and
exercise above is evidenced. The repository records completion by role and date
only; it must not contain the private register.

## Related procedures

- `COMMERCE-INCIDENT-OWNERSHIP.md`
- `COMMERCE-DISABLE-AND-ROLLBACK.md`
- `PAYMENT-PROVIDER-OUTAGE.md`
- `FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `CUSTOMER-DATA-RETENTION-AND-DELETION.md`
- `PRODUCTION-OWNERSHIP-AND-DEPUTY-APPOINTMENT-PACK.md`
