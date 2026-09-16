# Customer-support operations

**Status:** Pre-production operating baseline; channel, staffing, policies and accountable approval outstanding  
**Production commerce:** Disabled  
**Last engineering update:** 15 September 2026

## Purpose and boundary

Define how CYPH/1 customer support receives, verifies, classifies and resolves
commerce enquiries without bypassing payment, fulfilment, shipping, privacy or
product-safety controls.

This document does not approve a public support channel, operating hours,
response target, delivery promise, cancellation/return period, warranty,
replacement, goodwill payment or refund policy. Those require the final product,
operating model and accountable business/legal approval.

Support coordinates a case and communicates confirmed outcomes. It does not
create payment, shipment or regulatory truth from customer statements,
screenshots, emails or carrier pages.

## Core rules

- Use only the approved business support channel and protected operations
  surfaces; never use a personal account for order handling.
- Collect the minimum information needed to locate and handle the case.
- Verify the requester proportionately before disclosing order or delivery
  details or changing an instruction.
- Never request a full card number, security code, password, API key, payment
  login, identity document by default, or collection/pickup code.
- Never copy customer data into GitHub, source control, unrestricted chat,
  spreadsheets or incident tickets.
- Do not promise cancellation, refund, replacement, dispatch, delivery or
  collection-point change until the authoritative workflow confirms it.
- Keep marketing consent and transactional support separate. An order enquiry
  must not subscribe or resubscribe a customer.
- Preserve payment, fulfilment, shipment, return, safety, privacy and dispute
  states separately.
- Escalate uncertainty; do not repair order state with direct SQL or provider
  dashboard edits.

## Required roles

The restricted ownership register must identify:

- customer-support primary and deputy;
- technical operations primary and deputy;
- finance/reconciliation owner;
- fulfilment/shipping owner;
- privacy/legal owner and authorised deputy;
- product-safety/compliance decision owner; and
- executive launch owner.

One person may initially perform several operational roles, but formal
authority, separation of high-risk decisions and independent deputy coverage
must follow `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`.

## Case creation and minimum record

Create one restricted case containing:

| Field | Rule |
| --- | --- |
| Case reference | Non-personal unique reference |
| Received at | UTC timestamp and approved channel |
| Category/severity | One bounded value from this procedure |
| Customer/order link | Internal identifiers after verification; avoid personal data in title/subject |
| Verification state | `not_required`, `pending`, `passed` or `failed`; never record secret answers |
| Safe summary | Factual issue without unnecessary personal/payment/provider payloads |
| Owners | Current support owner and required specialist |
| Decisions/actions | Actor role, UTC time, bounded action and evidence reference |
| Customer updates | Approved template/purpose and delivery outcome |
| Hold/deadline | Applicable provider, dispute, privacy, safety or business deadline |
| Closure | Confirmed outcome, unresolved dependency, retention/review date |

Do not place the customer's email, postcode, address, tracking number or
payment reference in the case title or ordinary alert text.

## Requester verification

### No identity verification normally needed

- Public product, website or policy information.
- General troubleshooting that reveals no order/account information.
- Reporting a security, privacy or safety concern where identity is not needed
  to receive and escalate the report.

### Verification required

- Revealing order, payment, delivery, tracking, address or contact details.
- Cancellation, return, refund, reshipment or destination-change requests.
- Correction, access, erasure or consent-related requests.
- Obtaining proof-of-delivery or claim evidence.

Prefer control of the email address already recorded on the order through a
single-use, short-lived verification flow. If unavailable, use an approved
combination of low-risk order facts that the system can verify. Do not reveal
which guessed field was wrong. Escalate suspected takeover or repeated failed
verification without disclosing whether an order exists.

Identity verification for a privacy-rights request must be proportionate to
genuine doubt and follow the rights-request procedure; do not impose a routine
identity-document requirement.

## Classification and routing

| Code | Category | Primary owner | Mandatory handoff |
| --- | --- | --- | --- |
| `CS-GENERAL` | Product/site/policy question | Support | Claims/compliance if answer is not approved |
| `CS-CHECKOUT` | Basket, delivery selection or checkout problem before authoritative payment | Support | Technical operations for repeat/systemic faults |
| `CS-PAYMENT-UNKNOWN` | Customer reports charge/failure or local/provider outcome is unclear | Support | Finance/reconciliation and incident owner |
| `CS-CANCEL` | Request to stop an order | Support | Fulfilment and payment owners |
| `CS-DESTINATION` | Address or collection-point change | Support | Fulfilment/shipping owner |
| `CS-DELIVERY` | Tracking, delay, collection or failed delivery | Support | Fulfilment/shipping owner where evidence/action needed |
| `CS-LOST-DAMAGED` | Parcel missing, opened, damaged or incomplete | Support | Fulfilment/claims; safety owner if product may be unsafe |
| `CS-RETURN` | Consumer return request/status | Support | Fulfilment and finance as applicable |
| `CS-REFUND` | Refund request/status | Support | Finance/reconciliation |
| `CS-DISPUTE` | Chargeback, payment dispute or fraud allegation | Finance/reconciliation | Incident/privacy/security as applicable |
| `CS-WARRANTY` | Fault, repair, replacement or warranty question | Support | Product/compliance and fulfilment |
| `CS-SAFETY` | Injury, adverse event, overheating, electrical or product-safety concern | Product-safety/compliance owner | Incident commander and legal/compliance immediately |
| `CS-PRIVACY` | Rights request or suspected personal-data incident | Privacy/legal owner | Incident commander for suspected breach |
| `CS-SECURITY` | Account/order takeover, exposed label/code or malicious activity | Incident/security owner | Privacy, finance or fulfilment as affected |

A case can carry more than one category. Safety, privacy, security, duplicate
charge and wrong-destination concerns take priority over ordinary service
handling.

## Authoritative evidence hierarchy

Use the narrowest approved protected source:

1. CYPH/1 order/payment/fulfilment/shipment state and audit history.
2. Authenticated provider events processed through the application.
3. Reconciled provider API evidence through an approved adapter/operation.
4. Restricted provider dashboard or support response used for investigation.
5. Customer-supplied information used as a report, not authoritative state.

A browser redirect, email/SMS, screenshot, bank-app description or public
tracking page may trigger investigation but cannot alone mark an order paid,
refunded, dispatched, delivered, lost or returned.

## Checkout and payment enquiries

### Before a known payment

- Give approved validation guidance without asking for payment credentials.
- Preserve basket data only as designed; do not manually create an order or
  alter price, stock, tax or delivery charge.
- Escalate repeat errors with UTC time, internal request/correlation ID where
  available and a privacy-safe reproduction.

### Customer reports a charge but outcome is unclear

1. Classify `CS-PAYMENT-UNKNOWN`; do not advise the customer to pay again.
2. Locate the order/session through the protected workflow after verification.
3. Follow `PAYMENT-PROVIDER-OUTAGE.md` and reconcile using original references.
4. Do not state that a pending authorization, captured payment or refund has a
   particular meaning until finance/provider evidence establishes it.
5. Give a factual holding response and assign the next internal review time.

### Duplicate-charge allegation

Treat as urgent. Preserve provider/payment references securely, stop unsafe
repeat actions and escalate to finance/reconciliation and the incident owner.
Do not ask for a full bank statement or card details; request only specifically
approved redacted evidence if provider reconciliation cannot resolve it.

## Cancellation procedure

1. Verify the requester and locate authoritative payment and fulfilment state.
2. Record receipt time because consumer rights/provider cut-offs may matter.
3. If not dispatched, route the cancellation through the approved idempotent
   operation. Do not promise success while the command is pending/ambiguous.
4. If already dispatched, do not force cancellation; apply the approved
   intercept/return process and customer terms.
5. Reconcile fulfilment cancellation and payment refund separately.
6. Send confirmation only after the relevant authoritative transition.

Final cancellation rights, deductions and timings require legal approval and
must match published terms.

## Address and collection-point changes

- Before order submission/payment, the customer changes the selection through
  checkout and receives a new validated quote.
- After payment but before shipment booking, support must not edit snapshots
  directly. An approved audited operation must validate the new address/point,
  carrier service, price implications and customer confirmation.
- After booking/dispatch, use only supported carrier redirection/intercept
  processes. Keep the original immutable order selection and record any
  approved new destination separately.
- Never select an alternative Locker/Collection Point on the customer's behalf
  without their confirmation.
- Treat a wrong-destination booking as urgent and follow
  `SHIPPING-OUTAGE-AND-COLLECTION-POINT-FAILURE.md`.

## Delivery and tracking enquiries

1. Verify the requester before disclosing detailed tracking or destination.
2. Use normalized authenticated shipment status; do not infer movement from a
   missing event.
3. Explain only the approved status meaning and avoid inventing a delivery date.
4. For collection delivery, never send or repeat a pickup code through an
   unapproved channel. Direct the verified customer to the carrier's approved
   code-recovery route where appropriate.
5. If the collection window is expiring, state the provider-confirmed deadline
   and approved consequences without promising extension.
6. For delayed/mismatched tracking, reconcile through the shipping outage
   procedure before communicating a definitive outcome.

## Lost, damaged, incomplete or tampered parcel

1. Record the report promptly and preserve carrier claim deadlines.
2. Verify the order and shipment; capture only the evidence required by the
   approved carrier/insurer claim process.
3. Do not ask the customer to email sensitive images or documents to an
   unrestricted address. Strip unnecessary metadata where the approved evidence
   workflow permits.
4. Quarantine or advise non-use only under approved safety wording. Any sign of
   heat, electrical damage, exposed internals, broken optical components or
   injury is `CS-SAFETY` and must be escalated immediately.
5. Claims against a carrier/insurer, customer refund, replacement and product
   investigation are distinct decisions.
6. Do not promise compensation above the approved customer policy because a
   carrier claim is expected, or deny the customer solely because the carrier
   excludes compensation.

## Returns and warranty

- Confirm whether the request is cancellation/consumer return, faulty-product
  remedy, warranty support, safety investigation or goodwill; do not collapse
  them into one generic return.
- Provide an approved return method/reference only after eligibility and route
  are confirmed. Do not expose another customer's label or return code.
- Track customer return, return-to-sender and warranty replacement separately.
- Receipt at a locker/carrier is not proof that CYPH/1 received or inspected the
  product unless the approved policy says otherwise.
- Record inspection outcome through the authorized workflow without unnecessary
  images or free-form personal data.
- A returned product does not prove a refund has completed. Finance reconciles
  the payment provider separately.
- Do not restock a returned IPL device until hygiene, safety, condition and
  consumer-law controls for the selected product are approved.

Final eligibility, periods, return postage, hygiene seals, deductions, faulty
goods remedies and warranty terms remain launch decisions.

## Refund and dispute support

- Support may record and route a refund request but cannot mark it complete.
- Use an approved reason, amount and unique operator command; never calculate an
  amount informally when tax, delivery or partial refund allocation matters.
- An ambiguous refund remains `resolution_required`; do not submit another.
- Communicate completion only from authoritative provider/application evidence.
- Escalate chargebacks/disputes immediately with their provider deadline.
- Never pressure a customer to withdraw a statutory/payment dispute or promise
  an outcome outside the approved process.

Follow `REFUNDS-RETURNS-AND-DISPUTES.md` and
`PAYMENT-PROVIDER-OUTAGE.md`.

## Product safety and regulated escalation

Immediately escalate any report of injury, burn, unexpected skin reaction,
electric shock, overheating, fire/smoke, damaged cable/adapter, exposed
electrical part, unexpected light emission or another potential safety defect.

Support must:

1. use approved immediate-safety wording and emergency guidance;
2. preserve the product/batch/order identifiers and exact report time in the
   restricted case;
3. avoid diagnosing, assigning blame or making an unapproved medical/product
   claim;
4. obtain only the evidence requested by the product-safety owner;
5. prevent routine return/refurbishment from destroying relevant evidence; and
6. follow the approved product-safety, regulatory and incident decision path.

No safety script, reporting threshold or regulator route is approved by this
engineering baseline. Those must be established for the final device before
sale.

## Privacy and security cases

- Treat a request for access, correction, erasure or restriction under
  `DATA-SUBJECT-RIGHTS-OPERATIONS.md`; record its applicable deadline using the
  minimum fields in `DATA-SUBJECT-RIGHTS-REGISTER-SPECIFICATION.md` and apply
  the retention decisions in `CUSTOMER-DATA-RETENTION-AND-DELETION.md`.
- Marketing unsubscribe/withdrawal must be actioned independently from commerce
  support and must not erase required order evidence automatically.
- Exposed labels, tracking links, pickup codes, wrong-recipient communications
  or wrong-destination parcels may be personal-data/security incidents. Contain
  access and follow `PERSONAL-DATA-INCIDENT-ESCALATION.md`.
- Preserve evidence without circulating the exposed personal data.

## Customer communications

Every message must:

- use the approved CYPH/1 channel and template purpose;
- state confirmed facts, what remains under investigation and the next expected
  action without inventing timing;
- avoid unnecessary order, payment, address or tracking data in the subject;
- distinguish a request acknowledgement from an approved outcome;
- contain no marketing unless separate valid consent and campaign approval
  exist; and
- be recorded by semantic delivery key so a replay does not duplicate it.

Provider/carrier notifications must be mapped before launch so CYPH/1 does not
send contradictory or duplicate collection, dispatch or delivery messages.

## Escalation triggers

Escalate immediately for:

- captured payment without a matching order or alleged duplicate charge;
- shipment for an unpaid order, duplicate shipment or wrong destination;
- suspected account takeover, credential/label/code disclosure or fraud;
- personal data sent to the wrong person or publicly exposed;
- product safety allegation or pattern of similar faults;
- missed or threatened provider, dispute, privacy or regulatory deadline;
- inability to identify an authorised decision owner/deputy; or
- systemic checkout, payment, fulfilment, shipping or communications failure.

## Case closure

Close only when:

1. authoritative order/payment/fulfilment/shipment/refund states are reconciled;
2. every promised approved action is completed or has an accepted owner/date;
3. the customer receives an accurate closure/update through the approved
   channel;
4. safety, privacy, security, dispute and provider deadlines are resolved or
   formally handed over;
5. temporary evidence/exports are deleted or assigned an approved hold; and
6. outcome, residual risk and next review are recorded without unnecessary
   personal data.

Customer silence alone is not proof that a case is resolved.

## Pre-launch exercise

Use synthetic records and do not contact real customers or create live
payments/shipments.

1. General enquiry requiring no identity disclosure.
2. Failed verification that reveals neither order existence nor which answer
   was incorrect.
3. Ambiguous payment where support prevents a second attempt and escalates.
4. Pre-dispatch cancellation with payment/fulfilment handled separately.
5. Post-payment collection point becoming unavailable without silent
   substitution.
6. Missing tracking event where support does not promise loss or delivery.
7. Uncollected parcel/RTS kept separate from refund and customer return.
8. Damaged electronic device escalated to product safety without an unapproved
   diagnosis or compensation promise.
9. Erasure request with financial/claims records requiring scoped review.
10. Primary support owner unavailable and deputy assumes recorded authority.

Record only case identifiers, role actions, pass/fail results and remediation.
Provider-specific branches must be repeated later only where they test the
provider itself; this provider-neutral decision exercise remains the baseline.

## Launch gates

- [ ] Official support channel, monitored hours and accurate website wording approved.
- [ ] Support primary/deputy and specialist decision owners appointed.
- [ ] Proportionate verification method implemented and tested.
- [ ] Protected case/operations access and least-privilege permissions tested.
- [ ] Approved customer policies and response templates match implemented states.
- [ ] Payment, cancellation, destination, shipping, return, refund and dispute handoffs tested.
- [ ] Product-safety owner, script, evidence route and regulatory process approved.
- [ ] Privacy/security escalation and restricted registers tested.
- [ ] Provider/carrier notification ownership and duplicate-message controls approved.
- [ ] Case/export retention and deletion approved.
- [ ] Primary-unavailable exercise passed.
- [ ] Accountable launch owner signs the evidence.

## Related procedures

- `PRODUCTION-COMMERCE-OWNERSHIP-AND-SUPPORT.md`
- `PAYMENT-PROVIDER-OUTAGE.md`
- `FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`
- `SHIPPING-OUTAGE-AND-COLLECTION-POINT-FAILURE.md`
- `REFUNDS-RETURNS-AND-DISPUTES.md`
- `TRANSACTIONAL-COMMUNICATIONS.md`
- `CUSTOMER-DATA-RETENTION-AND-DELETION.md`
- `DATA-SUBJECT-RIGHTS-OPERATIONS.md`
- `DATA-SUBJECT-RIGHTS-REGISTER-SPECIFICATION.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
