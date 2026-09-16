# Customer-support response templates

**Status:** Draft provider-neutral template pack; policies, channels, owners,
product-safety wording, accessibility and accountable approval outstanding  
**Production use:** Not approved  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Provide controlled starting text for commerce support communications under
`CUSTOMER-SUPPORT-OPERATIONS.md`. These templates coordinate a case; they do
not create payment, cancellation, shipment, return, warranty, safety or refund
truth.

No template approves a support channel, operating hour, response target,
delivery promise, cancellation/return period, warranty, replacement,
compensation, refund policy or medical/safety instruction. Those depend on the
selected product, providers, operating model, consumer terms and accountable
business/legal/compliance approval.

## Template rules

1. Use the approved CYPH/1 business channel and current template version.
2. Use a neutral subject with `{{CASE_REFERENCE}}`; do not include a name,
   email, order/payment/tracking reference, address, collection point, safety
   symptom or dispute allegation.
3. Verify the requester before revealing order, payment, destination, tracking,
   return, refund or warranty details or accepting a change.
4. Treat customer statements, emails, bank-app descriptions, screenshots and
   public tracking pages as reports—not authoritative state.
5. Say “received” or “under review” until the approved application/provider
   workflow confirms the outcome. Do not imply that requesting cancellation,
   refund, redirection, return or replacement completed it.
6. Do not invent delivery, investigation, refund, provider or response times.
   Use `{{NEXT_UPDATE_POINT}}` only when an accountable owner has set it.
7. Never ask for a password, full card number, security code, payment login,
   API credential, collection/pickup code or identity document by default.
8. Keep transactional support separate from marketing. No message may enrol or
   re-enrol a customer in marketing.
9. Remove unused conditional blocks and every unresolved `{{PLACEHOLDER}}`.
10. Record template purpose/version, evidence state, approver where required and
    delivery outcome using a semantic delivery key to prevent duplicates.

## Common placeholders

| Placeholder | Rule |
| --- | --- |
| `{{CASE_REFERENCE}}` | Non-personal case reference safe for ordinary notifications |
| `{{CATEGORY}}` | Approved bounded support category, not free-form sensitive detail |
| `{{VERIFICATION_INSTRUCTIONS}}` | Approved proportionate verification path; no hints or secret answers |
| `{{CONFIRMED_STATUS}}` | Exact approved customer-facing meaning of authoritative state |
| `{{ACTION_COMPLETED}}` | Evidence-backed action only |
| `{{ACTION_PENDING}}` | Specific bounded action/owner class without an outcome promise |
| `{{CUSTOMER_ACTION}}` | Necessary customer step using approved policy/instructions |
| `{{NEXT_UPDATE_POINT}}` | Real owner/date/event trigger; never an invented service level |
| `{{SECURE_EVIDENCE_ROUTE}}` | Approved restricted upload/channel; never ordinary unrestricted email by default |
| `{{APPROVED_POLICY_LINK}}` | Published policy matching implemented terms and current product |
| `{{APPROVED_SAFETY_WORDING}}` | Final product-specific compliance-approved immediate wording |
| `{{APPROVED_PROVIDER_ROUTE}}` | Verified customer-safe provider recovery/tracking route |
| `{{CONTACT_ROUTE}}` | Approved CYPH/1 support route |
| `{{TEMPLATE_VERSION}}` | Approved version recorded with the communication |

Do not use placeholders for vague assertions such as “soon”, “our policy”,
“carrier delays” or “security reasons”. State confirmed facts and the next
bounded action.

## Pre-send check

- [ ] Correct case, category, recipient and verified channel.
- [ ] Required requester verification passed for the information/action.
- [ ] Stated status/action matches authoritative application/provider evidence.
- [ ] Payment, fulfilment, shipment, return and refund states are not collapsed.
- [ ] Policy, amount, timeframe, eligibility and remedy wording is approved.
- [ ] Safety, privacy, security, dispute or deadline escalation occurred first.
- [ ] No other person's data, secret, pickup code, raw provider payload or
      internal security/claims detail is included.
- [ ] Required evidence route is secure and asks only for necessary material.
- [ ] Message is accessible, concise and free of marketing.
- [ ] Unused blocks and placeholders are removed.
- [ ] Template version, semantic delivery key and outcome will be recorded.

## CS-T01 — general acknowledgement

**Use:** A support message has been received; no order-specific disclosure or
outcome is confirmed.  
**Approval:** Trained support operator.  
**Subject:** `We received your CYPH/1 message — {{CASE_REFERENCE}}`

```text
Hello,

Thank you for contacting CYPH/1. We have recorded your message under reference
{{CASE_REFERENCE}} and classified it as {{CATEGORY}}.

We are reviewing the information you provided. If we need further information,
we will ask only for what is necessary. Please do not send passwords, full
payment-card details, security codes or collection codes.

Our next update will be {{NEXT_UPDATE_POINT}}.

You can contact us through {{CONTACT_ROUTE}} and quote
{{CASE_REFERENCE}}.

CYPH/1 Support
```

If no accountable update point exists, assign one internally before sending;
do not substitute “as soon as possible”.

## CS-T02 — requester verification required

**Use:** Order/account information or a change cannot be disclosed/actioned
until verification.  
**Approval:** Trained operator using the approved verification method.  
**Subject:** `Verification needed for your CYPH/1 request — {{CASE_REFERENCE}}`

```text
Hello,

Before we can disclose order information or make the requested change, we need
to take reasonable steps to verify that we are dealing with the right person.

Please follow: {{VERIFICATION_INSTRUCTIONS}}.

Do not send a password, full payment-card details, security code, payment login
or collection code. This message does not confirm whether CYPH/1 holds a
particular account or order.

If you cannot use this method or need an accessible alternative, contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Support
```

## CS-T03 — verification unsuccessful

**Use:** Approved attempts did not establish sufficient identity.  
**Approval:** Support owner; security escalation first where takeover is
suspected.  
**Subject:** `Update on your CYPH/1 request — {{CASE_REFERENCE}}`

```text
Hello,

We have not been able to establish sufficient verification to disclose or
change the information covered by case {{CASE_REFERENCE}}.

For security, we cannot confirm whether a particular account or order exists,
or identify which verification item did not match.

[IF AN APPROVED ALTERNATIVE EXISTS]
You may use this alternative route: {{VERIFICATION_INSTRUCTIONS}}.
[END IF]

If you believe this is an error, contact {{CONTACT_ROUTE}} and quote
{{CASE_REFERENCE}}.

CYPH/1 Support
```

Do not describe a privacy-rights request as invalid; hand it to the DSR process.

## CS-T04 — checkout technical issue

**Use:** No authoritative captured payment or order outcome is established.  
**Approval:** Support; technical escalation for repeat/systemic faults.  
**Subject:** `Update on your CYPH/1 checkout report — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded the checkout issue you reported under
{{CASE_REFERENCE}}.

Confirmed information: {{CONFIRMED_STATUS}}.

[IF PAYMENT STATUS IS NOT AUTHORITATIVE]
We have not yet established an authoritative payment outcome. Please do not
repeat the payment attempt unless we confirm that it is safe to do so.
[END IF]

[IF SAFE CUSTOMER TROUBLESHOOTING IS APPROVED]
You may try: {{CUSTOMER_ACTION}}.
[END IF]

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Never alter price, stock, tax or delivery charge manually to resolve a browser
problem.

## CS-T05 — payment outcome uncertain

**Use:** The customer reports a charge/failure, while CYPH/1 and provider state
are not reconciled.  
**Approval:** Finance/reconciliation handoff completed.  
**Subject:** `We are checking your CYPH/1 payment — {{CASE_REFERENCE}}`

```text
Hello,

We are checking the payment report recorded under
{{CASE_REFERENCE}}.

The payment outcome is not yet confirmed in our authoritative records. Please
do not make another payment attempt for the same purchase while we reconcile it.

You do not need to send full card details, a security code or payment-login
information. If specific evidence is required, we will provide an approved
secure route and explain exactly what is needed.

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

A pending bank entry, checkout redirect or provider email does not by itself
prove capture, failure, cancellation or refund.

## CS-T06 — suspected duplicate charge

**Use:** Duplicate charge reported; urgent finance/incident assessment active.  
**Approval:** Finance/reconciliation owner; incident owner where indicated.  
**Subject:** `We are reviewing your CYPH/1 payment report — {{CASE_REFERENCE}}`

```text
Hello,

We have prioritised your report of a possible duplicate payment under
{{CASE_REFERENCE}}.

Please do not attempt the payment again. We are reconciling the original
transaction references and will not submit another payment or refund merely to
test the status.

[IF MINIMUM REDACTED EVIDENCE IS GENUINELY REQUIRED]
Please provide only {{MINIMUM_EVIDENCE}} through
{{SECURE_EVIDENCE_ROUTE}}. Redact unrelated transactions and all full card or
account credentials.
[END IF]

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not promise a refund until the duplicate and approved remedy are confirmed.

## CS-T07 — cancellation request received

**Use:** The request is logged but payment/fulfilment state and eligibility are
not yet reconciled.  
**Approval:** Support after verification and handoff.  
**Subject:** `Your CYPH/1 cancellation request — {{CASE_REFERENCE}}`

```text
Hello,

We have received your cancellation request and recorded its receipt time under
{{CASE_REFERENCE}}.

Your request is not yet confirmation that the order, fulfilment or payment has
been cancelled. We are checking the authoritative payment and fulfilment state
and applying the approved cancellation process.

Please do not return an item or make another payment unless we provide the
applicable approved instructions.

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

## CS-T08 — cancellation outcome confirmed

**Use:** Authoritative order/fulfilment cancellation is known; payment/refund
state is stated separately.  
**Approval:** Fulfilment plus finance evidence as applicable.  
**Subject:** `Outcome of your CYPH/1 cancellation request — {{CASE_REFERENCE}}`

```text
Hello,

We have completed the cancellation review for
{{CASE_REFERENCE}}.

Order/fulfilment outcome: {{CONFIRMED_FULFILMENT_OUTCOME}}.
Payment/refund outcome: {{CONFIRMED_PAYMENT_OUTCOME}}.

[IF A RETURN ROUTE IS NOW REQUIRED]
The item had reached a stage where the approved return process applies:
{{CUSTOMER_ACTION}}.
[END IF]

[IF A REFUND IS PENDING]
A refund is not yet confirmed as complete. We are {{ACTION_PENDING}} and will
update you {{NEXT_UPDATE_POINT}}.
[END IF]

CYPH/1 Support
```

Never use fulfilment cancellation as proof of refund completion.

## CS-T09 — address or collection-point change

**Use:** A destination change is requested.  
**Approval:** Fulfilment/shipping owner after verification.  
**Subject:** `Your CYPH/1 delivery request — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your request to change the delivery destination under
{{CASE_REFERENCE}}.

Confirmed shipment stage: {{CONFIRMED_STATUS}}.

[IF CHANGE IS STILL BEING VALIDATED]
The change has not yet been accepted. We are checking whether the requested
destination, service and any price or delivery implications can be supported.
Do not rely on the new destination until we confirm it.
[END IF]

[IF RESELECTION IS REQUIRED]
We cannot silently choose another Locker / Collection Point for you. Please use
the approved reselection process: {{CUSTOMER_ACTION}}.
[END IF]

[IF CHANGE IS AUTHORITATIVELY CONFIRMED]
The approved destination change is confirmed through the secure order view:
{{APPROVED_PROVIDER_ROUTE}}. We have preserved the original order evidence and
recorded the authorised change separately.
[END IF]

Our next update, if required, will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not repeat a full address, point code or pickup code in ordinary email.

## CS-T10 — delivery or tracking uncertainty

**Use:** Tracking is delayed, missing or inconsistent; loss/delivery is not
authoritatively established.  
**Approval:** Support with fulfilment/shipping handoff.  
**Subject:** `We are checking your CYPH/1 delivery — {{CASE_REFERENCE}}`

```text
Hello,

We are checking the delivery information associated with
{{CASE_REFERENCE}}.

Confirmed status: {{CONFIRMED_STATUS}}.

We do not yet have authoritative evidence to state that the parcel is
{{UNCONFIRMED_OUTCOME}}. A delayed or missing tracking event alone does not
confirm that outcome.

We are reconciling the authenticated carrier/provider history. Our next update
will be {{NEXT_UPDATE_POINT}}.

[IF AN APPROVED CUSTOMER-SAFE TRACKING ROUTE EXISTS]
You can view the current customer-safe status through:
{{APPROVED_PROVIDER_ROUTE}}.
[END IF]

CYPH/1 Support
```

Do not invent a delivery date or expose detailed tracking/destination before
verification.

## CS-T11 — collection point unavailable, expired or return-to-sender

**Use:** Authoritative provider evidence confirms the collection/RTS state.  
**Approval:** Fulfilment/shipping owner; finance separately for refund.  
**Subject:** `Update on your CYPH/1 collection delivery — {{CASE_REFERENCE}}`

```text
Hello,

The confirmed status for {{CASE_REFERENCE}} is:
{{CONFIRMED_STATUS}}.

[IF POINT BECAME UNAVAILABLE BEFORE CONFIRMATION/BOOKING]
The selected location cannot currently be used. We will not substitute another
location without your confirmation. Please: {{CUSTOMER_ACTION}}.
[END IF]

[IF COLLECTION PERIOD EXPIRED OR RETURN TO SENDER STARTED]
The parcel and any return movement are being tracked separately from any
customer return or payment refund. This status does not itself confirm that a
refund or redispatch has been completed.
[END IF]

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

## CS-T12 — missing, damaged, incomplete or tampered parcel

**Use:** A report has been recorded and evidence/claims/safety triage is under
way.  
**Approval:** Support plus fulfilment/claims; product-safety owner if indicated.  
**Subject:** `We are reviewing your CYPH/1 delivery report — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your report under {{CASE_REFERENCE}} and are reviewing the
order, shipment and available delivery evidence.

[IF MINIMUM EVIDENCE IS REQUIRED]
Please provide only {{MINIMUM_EVIDENCE}} through
{{SECURE_EVIDENCE_ROUTE}}. Do not include unrelated people, documents or
account information.
[END IF]

[IF A SAFETY INDICATOR EXISTS]
We have escalated this to the CYPH/1 product-safety process. Please follow only
the approved immediate wording below:
{{APPROVED_SAFETY_WORDING}}
[END IF]

A carrier claim, customer remedy, replacement, refund and safety investigation
are separate decisions. We will not ask you to destroy or return potential
safety evidence until the authorised process confirms what is required.

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not blame the carrier, deny a customer remedy because carrier compensation
is excluded, or promise compensation/replacement before approval.

## CS-T13 — return request received

**Use:** Return type, eligibility and route remain under assessment.  
**Approval:** Support; fulfilment/legal/finance as applicable.  
**Subject:** `Your CYPH/1 return request — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your return request under {{CASE_REFERENCE}}.

We are determining whether this is an approved cancellation return,
faulty-product remedy, warranty process, safety investigation or another return
route. Your request is not yet a return authorisation or refund confirmation.

Please do not send the product until we provide the approved return method and
reference. If there may be a product-safety concern, do not use ordinary return
steps; follow only the separate safety instructions we provide.

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not invent eligibility periods, postage responsibility, hygiene conditions
or deductions before approved terms exist.

## CS-T14 — return received or inspected

**Use:** Authoritative receipt/inspection is known; refund remains separate.  
**Approval:** Fulfilment/inspection owner; product-safety handoff if required.  
**Subject:** `Update on your CYPH/1 return — {{CASE_REFERENCE}}`

```text
Hello,

Confirmed return status for {{CASE_REFERENCE}}:
{{CONFIRMED_STATUS}}.

[IF INSPECTION COMPLETE]
Approved inspection outcome: {{INSPECTION_OUTCOME}}.
[END IF]

Receipt by a carrier or CYPH/1 does not itself confirm a payment refund. The
payment/refund status is: {{CONFIRMED_PAYMENT_OUTCOME}}.

[IF FURTHER ACTION IS PENDING]
We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.
[END IF]

CYPH/1 Support
```

## CS-T15 — fault or warranty request

**Use:** Fault/warranty report has been received; eligibility/remedy is not yet
approved.  
**Approval:** Support with product/compliance and fulfilment handoff.  
**Subject:** `We are reviewing your CYPH/1 product report — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded the product issue you reported under
{{CASE_REFERENCE}}.

We are assessing the report under the applicable consumer, product-safety and
warranty processes. This acknowledgement does not yet confirm warranty
coverage, cause, repair, replacement or refund.

[IF MINIMUM DIAGNOSTIC INFORMATION IS APPROVED]
Please provide: {{MINIMUM_EVIDENCE}} through
{{SECURE_EVIDENCE_ROUTE}}.
[END IF]

[IF SAFETY ESCALATION IS REQUIRED]
Please stop ordinary troubleshooting and follow:
{{APPROVED_SAFETY_WORDING}}.
[END IF]

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not diagnose, assign blame or quote an unapproved warranty duration.

## CS-T16 — refund pending or ambiguous

**Use:** Refund is approved/submitted or reported, but authoritative completion
is not confirmed.  
**Approval:** Finance/reconciliation owner.  
**Subject:** `Update on your CYPH/1 refund — {{CASE_REFERENCE}}`

```text
Hello,

Refund status for {{CASE_REFERENCE}}:
{{CONFIRMED_STATUS}}.

The refund is not yet confirmed as completed in the authoritative payment
records. We will not submit a second refund while the original outcome is
pending or ambiguous.

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

Please do not send full card details, security codes or payment-login
information.

CYPH/1 Support
```

Do not describe a provider “accepted” or “pending” state as funds received by
the customer.

## CS-T17 — refund completed

**Use:** Authoritative provider/application evidence confirms completion and
the amount/purpose has been independently checked.  
**Approval:** Finance/reconciliation owner.  
**Subject:** `Your CYPH/1 refund is confirmed — {{CASE_REFERENCE}}`

```text
Hello,

Our authoritative payment records confirm that the approved refund for
{{CASE_REFERENCE}} completed on {{CONFIRMED_COMPLETION_DATE}}.

Refund amount and currency: {{APPROVED_REFUND_AMOUNT}}.

The time taken for a completed refund to appear through your payment method may
depend on the payment provider or financial institution. We will not state a
specific appearance time unless it is part of the approved provider wording.

If the completed refund does not appear after the applicable approved period,
contact {{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Support
```

Never include full payment credentials or unrelated order data.

## CS-T18 — payment dispute or fraud allegation

**Use:** A chargeback, dispute or fraud report is routed to finance/incident
owners.  
**Approval:** Finance/reconciliation and incident owner as applicable.  
**Subject:** `We are reviewing your CYPH/1 payment concern — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your payment concern under {{CASE_REFERENCE}} and escalated it
to the appropriate finance and security process.

Please do not send full card details, security codes, online-banking credentials
or a complete bank statement. If minimum redacted evidence is required, we will
specify it and provide {{SECURE_EVIDENCE_ROUTE}}.

We will not ask you to withdraw a statutory or payment-provider dispute as a
condition of reviewing the matter.

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not admit liability, accuse the customer or promise the provider's dispute
outcome.

## CS-T19 — product-safety escalation acknowledgement

**Use:** Potential injury, reaction, electrical, heat, fire, optical or other
safety concern.  
**Approval:** The report must be escalated immediately. Only compliance-approved
immediate safety wording may be inserted.  
**Subject:** `CYPH/1 safety report received — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your report under {{CASE_REFERENCE}} and escalated it to the
CYPH/1 product-safety process.

{{APPROVED_SAFETY_WORDING}}

Please preserve the product, external power adapter, packaging and relevant
evidence unless the approved safety instructions say otherwise. Do not send
medical information, images or documents through an unrestricted channel. If
the safety owner requires specific evidence, we will provide
{{SECURE_EVIDENCE_ROUTE}} and explain what is necessary.

We cannot diagnose a medical condition or determine cause through this support
message. Our next safety-process update will be
{{NEXT_UPDATE_POINT}}.

CYPH/1 Product Safety
```

This template must remain unusable until product-specific immediate wording,
emergency escalation and regulatory ownership are approved. It must never
delay contacting emergency services where the approved wording requires that.

## CS-T20 — privacy or security escalation

**Use:** Suspected exposed personal data, account/order takeover, exposed label/
code, wrong recipient or malicious activity.  
**Approval:** Incident/privacy/security owner after immediate containment route
is engaged.  
**Subject:** `We are reviewing your CYPH/1 report — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your report under {{CASE_REFERENCE}} and escalated it through
the CYPH/1 privacy/security incident process.

Please do not forward exposed links, credentials, labels, collection codes or
another person's information through an ordinary message. If evidence is
required, we will specify the minimum needed and provide
{{SECURE_EVIDENCE_ROUTE}}.

We are {{ACTION_PENDING}}. Our next update will be
{{NEXT_UPDATE_POINT}}.

This acknowledgement is not a conclusion about whether a personal-data breach,
account compromise or unauthorised transaction occurred.

CYPH/1 Support
```

Rights requests must be handed to the DSR runbook and use the separately
approved DSR communication templates.

## CS-T21 — provider outage holding response

**Use:** An outage affects the case, but payment/shipment/refund outcomes remain
bounded and independently controlled.  
**Approval:** Incident owner and relevant finance/fulfilment owner.  
**Subject:** `Service update for your CYPH/1 case — {{CASE_REFERENCE}}`

```text
Hello,

An external service issue is affecting {{BOUNDED_CUSTOMER_FUNCTION}} for case
{{CASE_REFERENCE}}.

Confirmed impact: {{CONFIRMED_STATUS}}.
Not yet confirmed: {{UNCONFIRMED_OUTCOME}}.

We have contained the affected workflow and are reconciling existing actions.
Please do not repeat {{UNSAFE_REPEAT_ACTION}} while its original outcome is
uncertain.

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not blame/name the provider unnecessarily, copy its status wording without
assessment or promise recovery based only on a public status page.

## CS-T22 — case progress update

**Use:** A material verified update is available; the case is not closed.  
**Approval:** Current case owner.  
**Subject:** `Update on your CYPH/1 case — {{CASE_REFERENCE}}`

```text
Hello,

We are writing with an update on {{CASE_REFERENCE}}.

Confirmed since our last message:
{{COMPLETED_ACTIONS}}

Still in progress:
{{ACTION_PENDING}}

Our next update will be {{NEXT_UPDATE_POINT}}.

CYPH/1 Support
```

Do not resend identical progress messages or imply customer silence is needed
for CYPH/1 to continue an already required action.

## CS-T23 — case closure

**Use:** Authoritative states are reconciled, promised approved actions are
complete or formally handed over, and safety/privacy/security deadlines are
resolved.  
**Approval:** Case owner plus required specialist/independent closure review.  
**Subject:** `Your CYPH/1 case is complete — {{CASE_REFERENCE}}`

```text
Hello,

The approved actions for {{CASE_REFERENCE}} are complete.

Confirmed outcome:
{{COMPLETED_ACTIONS}}

[IF A SEPARATE ONGOING PROCESS REMAINS]
The following separate process remains open under its own reference/owner:
{{FORMAL_HANDOFF_SUMMARY}}.
[END IF]

If you believe the confirmed outcome is incomplete or inaccurate, contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Support
```

A sent message, customer silence, carrier receipt, return arrival or submitted
refund is not by itself closure.

## Approval and version record

Keep signed approvals, live contact details and private channel configurations
in the restricted governance system. Record only roles, dates and versions in
source control:

```text
Template-pack version:
Customer-support owner approval role/date:
Consumer/legal approval role/date:
Finance approval role/date:
Fulfilment/shipping approval role/date:
Product-safety/compliance approval role/date:
Privacy/security approval role/date:
Accessibility reviewer role/date:
Approved support channel/version:
Approved policy/content versions:
Production use approved: yes/no
Next scheduled review:
```

Review after a policy, product, provider, delivery method, payment flow,
warranty/return process, safety instruction, complaint, incident or relevant
law/guidance change.

## Related procedures

- `CUSTOMER-SUPPORT-OPERATIONS.md`
- `DATA-SUBJECT-RIGHTS-COMMUNICATION-TEMPLATES.md`
- `FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`
- `PAYMENT-PROVIDER-OUTAGE.md`
- `PERSONAL-DATA-INCIDENT-ESCALATION.md`
- `REFUNDS-RETURNS-AND-DISPUTES.md`
- `SHIPPING-OUTAGE-AND-COLLECTION-POINT-FAILURE.md`
- `TRANSACTIONAL-COMMUNICATIONS.md`

