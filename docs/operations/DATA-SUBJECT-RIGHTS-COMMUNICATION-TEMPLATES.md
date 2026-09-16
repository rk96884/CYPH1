# Data-subject rights communication templates

**Status:** Draft provider-neutral template pack; privacy/legal approval,
approved channels and accessibility review outstanding  
**Production use:** Not approved  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Provide clear, consistent starting text for communications issued under
`DATA-SUBJECT-RIGHTS-OPERATIONS.md`. Templates reduce omission and accidental
disclosure; they do not decide whether a right applies, whether identity is
sufficient, whether an extension/exemption is lawful, or whether data may be
retained.

Every live message requires the case facts, current-law review and approval
specified below. Do not paste a real request, identity document, response pack,
address, payment reference or provider payload into this repository.

## Template rules

1. Use the approved CYPH/1 business channel and current template version.
2. Keep the subject neutral. Never include an email address, order/payment/
   tracking reference, postcode, request type or sensitive outcome in it.
3. Use `{{CASE_REFERENCE}}` as the only routine case identifier visible in the
   subject or ordinary notification.
4. Do not confirm that a person, account, order or record exists before
   proportionate verification.
5. Distinguish completed actions, approved decisions, work in progress and
   unknowns. Never say data has been deleted, corrected or restricted without
   evidence.
6. Include only case-specific categories and reasons. Delete unused conditional
   blocks; never send drafting notes or unresolved placeholders.
7. Do not describe an extension, exemption, refusal, fee or retention period
   without the authorised recorded decision and applicable current-law check.
8. Use accessible plain language and the person's preferred accessible format
   where reasonably required. Do not rely on colour or attachments alone.
9. Deliver personal data only through the approved verified secure channel;
   ordinary notification text must not contain the response data.
10. Record template version, approver role, delivery method/outcome and disposal
    trigger in the restricted DSR register—not a duplicate message in GitHub.

## Placeholder vocabulary

Use only the minimum placeholders needed:

| Placeholder | Meaning and control |
| --- | --- |
| `{{CASE_REFERENCE}}` | Non-personal DSR case reference |
| `{{REQUEST_DATE}}` | Date request was received; avoid unnecessary exact time in customer copy |
| `{{VERIFICATION_RECEIVED_DATE}}` | Date sufficient authorised identity/authority information was received where relevant |
| `{{RESPONSE_DEADLINE}}` | Deadline calculated and reviewed under current guidance |
| `{{REVISED_DEADLINE}}` | Authorised extended deadline, calculated from the correct start point |
| `{{RIGHTS_IN_SCOPE}}` | Plain-language bounded list of requests recognised |
| `{{MINIMUM_VERIFICATION_REQUEST}}` | Case-specific proportionate information needed; no secret-answer hints |
| `{{CLARIFICATION_NEEDED}}` | Narrow point genuinely needed to conduct an effective search/response |
| `{{COMPLETED_ACTIONS}}` | Evidence-backed actions only |
| `{{RETAINED_CATEGORIES_AND_REASONS}}` | Category-specific authorised explanation without internal legal advice |
| `{{RESTRICTION_SCOPE}}` | Data/purpose restricted in plain language |
| `{{RESTRICTION_LIFT_REASON}}` | Authorised reason and resulting processing, stated before lift |
| `{{OUTSTANDING_ACTIONS}}` | Specific processor/technical action, owner class and expected update—not an invented completion promise |
| `{{SECURE_DELIVERY_INSTRUCTIONS}}` | Approved time-limited/authenticated retrieval instructions |
| `{{CONTACT_ROUTE}}` | Approved CYPH/1 privacy contact route |
| `{{COMPLAINT_BLOCK}}` | Current approved controller/ICO/court wording for the applicable right/outcome |
| `{{TEMPLATE_VERSION}}` | Approved version recorded in the DSR register |

Do not use a placeholder to bypass review with vague wording such as “legal
reasons”, “business requirements” or “our policy”. Explain the actual category
and authorised basis at the appropriate level.

## Pre-send control

For every message, confirm:

- [ ] case and recipient/channel match;
- [ ] identity/authority is sufficient for the content being disclosed;
- [ ] deadline and dates were independently checked;
- [ ] stated actions match authoritative evidence;
- [ ] case-specific decision owner approved any extension, refusal, exemption,
      retention, restriction lift or fee;
- [ ] no other person's data, secret, internal security detail or privileged
      advice is included;
- [ ] attachments/links are the approved version and secure-delivery expiry is
      appropriate;
- [ ] unused blocks and all `{{PLACEHOLDERS}}` are removed;
- [ ] accessibility and reasonable-adjustment needs are met;
- [ ] template version, approval and delivery outcome will be recorded; and
- [ ] marketing content is absent.

## T01 — safe initial acknowledgement

**Use:** Receipt of one or more rights requests before identity or scope is
fully assessed.  
**Approval:** Trained request coordinator; privacy escalation if unusual.  
**Subject:** `Your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

Thank you for contacting CYPH/1. We have recorded your message under reference
{{CASE_REFERENCE}} and are reviewing the requests you made.

We currently understand your message to concern: {{RIGHTS_IN_SCOPE}}.

We may contact you if we reasonably need more information to confirm identity,
authority or the information covered by your request. We will ask only for what
is necessary and will not ask for your password or full payment-card details.

We will respond without undue delay and within the applicable timeframe. If a
different timeframe lawfully applies, we will explain this to you.

You can contact us through {{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Privacy
```

Do not add “we found your account/order” unless identity is verified and that
disclosure is necessary.

## T02 — proportionate identity or authority request

**Use:** Reasonable doubt exists, or a representative's authority must be
confirmed.  
**Approval:** Request coordinator using an approved verification method; privacy
owner for formal ID or unusual risk.  
**Subject:** `Information needed for your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We need to take reasonable steps to make sure that personal information is not
disclosed or changed for the wrong person.

Before we can progress the affected parts of request {{CASE_REFERENCE}}, please
provide: {{MINIMUM_VERIFICATION_REQUEST}}.

We are requesting this information only to confirm identity or authority for
this request. Please do not send passwords, full payment-card details, security
codes or information we have not asked for.

[IF AN APPROVED SECURE SUBMISSION ROUTE IS REQUIRED]
Please use: {{SECURE_DELIVERY_INSTRUCTIONS}}. Do not send identity evidence as
an ordinary email attachment.
[END IF]

This message does not confirm whether CYPH/1 holds a particular account, order
or record. Once we receive sufficient information, we will confirm the
applicable response deadline.

If you cannot use this method or need an accessible alternative, contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Privacy
```

Never reveal which guessed fact was wrong. Record method/outcome, not secret
answers, and dispose of temporary evidence under the approved short rule.

## T03 — clarification request

**Use:** Clarification is reasonably required to conduct an effective search or
understand an action; not to discourage a broad request.  
**Approval:** Request coordinator; privacy owner where the deadline effect or
scope is uncertain.  
**Subject:** `Clarifying your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We are working on privacy request {{CASE_REFERENCE}}. To identify the personal
information or action you want as accurately as possible, please clarify:

{{CLARIFICATION_NEEDED}}

You do not need to use legal terminology. Please describe the information,
interaction or approximate period you mean. We will continue the work that can
reasonably proceed while we await your reply.

If you need help or an accessible alternative, contact {{CONTACT_ROUTE}} and
quote {{CASE_REFERENCE}}.

CYPH/1 Privacy
```

Do not claim the clock stopped or reset without a case-specific decision under
current guidance.

## T04 — direct-marketing objection confirmation

**Use:** An address/channel has objected to direct marketing or withdrawn
marketing consent. Process independently from other rights.  
**Approval:** Trained coordinator after authoritative suppression evidence.  
**Subject:** `Your CYPH/1 marketing preference — {{CASE_REFERENCE}}`

```text
Hello,

We have recorded your request not to receive or have your information used for
CYPH/1 direct marketing through {{CHANNEL_DESCRIPTION}}.

We have stopped that direct-marketing use. We may retain the minimum information
needed on a suppression list so that your preference continues to be respected.
This suppression information is not used to send marketing.

This does not prevent service messages that are necessary for a transaction or
request you make, where applicable.

If you believe you receive further direct marketing from CYPH/1, contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

CYPH/1 Privacy
```

Do not imply suppression of another claimed address until its connection is
appropriately established.

## T05 — authorised deadline extension notice

**Use:** A current-law extension is necessary and authorised because the
specific request is complex or the person has made a number of requests. Send
within the applicable initial period.  
**Approval:** Privacy/legal decision owner.  
**Subject:** `Update on your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We are continuing to work on privacy request {{CASE_REFERENCE}}.

We need additional time because: {{CASE_SPECIFIC_EXTENSION_REASON}}.

We are therefore extending the response period in accordance with the
applicable data-protection rules. Our revised deadline is
{{REVISED_DEADLINE}}. This date has been calculated from the applicable
original start date; it is not a new request date.

We will continue the work without undue delay and will contact you sooner if we
can complete the response before that date.

{{COMPLAINT_BLOCK}}

CYPH/1 Privacy
```

Processor delay, staff absence or a standard policy is not by itself adequate
reasoning. The current ICO access guidance describes an extension of up to a
further two months where necessary and calculation as three months from the
original start date.

## T06 — secure access response ready

**Use:** The independently reviewed access pack is ready. This notification
contains no personal data from the pack.  
**Approval:** Privacy owner/independent disclosure reviewer.  
**Subject:** `Your CYPH/1 privacy response is ready — {{CASE_REFERENCE}}`

```text
Hello,

Your response for case {{CASE_REFERENCE}} is ready through our approved secure
delivery method.

{{SECURE_DELIVERY_INSTRUCTIONS}}

The retrieval method is available until {{ACCESS_EXPIRY}}. If it expires before
you can use it, or you need an accessible alternative, contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}}.

For your security, do not forward access credentials or the response package.

CYPH/1 Privacy
```

Send any password or second factor through an independently verified separate
channel. Record delivery/access outcome without copying the pack into the case
timeline.

## T07 — access response cover note

**Use:** Inside the secure access response.  
**Approval:** Privacy owner and independent disclosure reviewer.  

```text
Case reference: {{CASE_REFERENCE}}
Response date: {{RESPONSE_DATE}}

This response contains the personal information CYPH/1 identified through the
reasonable and proportionate search described below, together with the
applicable supplementary information.

Search scope: {{SYSTEM_AND_PERIOD_SCOPE}}
Personal-information categories: {{DATA_CATEGORIES}}
Purposes: {{PURPOSES}}
Recipients or recipient information: {{RECIPIENTS}}
Sources not obtained directly from you: {{SOURCES_OR_NOT_APPLICABLE}}
Retention periods or criteria: {{RETENTION_INFORMATION}}
Transfer safeguards, where applicable: {{TRANSFER_INFORMATION}}
Automated-decision information, where applicable: {{AUTOMATION_INFORMATION}}

Information withheld or redacted: {{REDACTION_EXPLANATION_OR_NONE}}

{{RIGHTS_AND_COMPLAINT_BLOCK}}
```

Do not include a provider's whole record, another person's information,
credentials, secret/security material or unexplained database codes. Describe
redactions/exemptions as far as permitted without defeating them.

## T08 — rectification outcome

**Use:** Accuracy assessment and approved actions are complete or clearly
separated from outstanding execution.  
**Approval:** Privacy owner; relevant data owner; independent review for partial
refusal.  
**Subject:** `Outcome of your CYPH/1 correction request — {{CASE_REFERENCE}}`

```text
Hello,

We have completed our assessment of the correction request in case
{{CASE_REFERENCE}}.

Completed corrections:
{{COMPLETED_ACTIONS}}

[IF AN ACCURATE HISTORICAL RECORD WAS NOT REWRITTEN]
We have not changed {{HISTORICAL_CATEGORY}} because it accurately records
{{HISTORICAL_CONTEXT}} at the time. We have {{CONTEXT_OR_CURRENT_STATE_ACTION}}
so that it is not treated as your current reusable information.
[END IF]

[IF ANY REQUESTED CORRECTION WAS NOT MADE]
We have not changed {{CATEGORY}} because: {{AUTHORISED_REASON}}.
{{COMPLAINT_BLOCK}}
[END IF]

[IF RECIPIENT ACTION IS OUTSTANDING]
Outstanding recipient action: {{OUTSTANDING_ACTIONS}}. We will update you by
{{NEXT_UPDATE_DATE}}.
[END IF]

CYPH/1 Privacy
```

Never overwrite an accurate completed-order snapshot merely because current
reusable information changed.

## T09 — restriction applied

**Use:** An applicable restriction ground and enforceable scope are confirmed.  
**Approval:** Privacy/legal decision owner plus technical/data owner evidence.  
**Subject:** `Restriction applied to your CYPH/1 information — {{CASE_REFERENCE}}`

```text
Hello,

We have restricted the following processing for case {{CASE_REFERENCE}}:
{{RESTRICTION_SCOPE}}.

While the restriction applies, we will store the affected information but will
not use it for ordinary processing, except where the applicable rules permit
and the use is authorised.

We have notified the relevant recipients where required and practicable:
{{RECIPIENT_INFORMATION_OR_APPROVED_SUMMARY}}.

We will tell you before we lift the restriction where required. Contact
{{CONTACT_ROUTE}} and quote {{CASE_REFERENCE}} if you have questions.

CYPH/1 Privacy
```

Do not send until restriction is technically effective; a case note alone is
not sufficient.

## T10 — notice before restriction is lifted

**Use:** CYPH/1 has an authorised basis to lift a restriction and must notify
the person before doing so.  
**Approval:** Privacy/legal decision owner and independent review.  
**Subject:** `Notice about restriction of your CYPH/1 information — {{CASE_REFERENCE}}`

```text
Hello,

We previously restricted {{RESTRICTION_SCOPE}} for case {{CASE_REFERENCE}}.

We intend to lift that restriction on {{LIFT_DATE_NOT_BEFORE_NOTICE}} because:
{{RESTRICTION_LIFT_REASON}}.

After the restriction is lifted, the following processing may resume:
{{PROCESSING_TO_RESUME}}.

[IF THIS ALSO REFUSES RECTIFICATION OR OBJECTION]
We have not accepted {{RELATED_REQUEST}} because: {{AUTHORISED_REASON}}.
[END IF]

{{COMPLAINT_BLOCK}}

If you believe this notice is based on an error, contact {{CONTACT_ROUTE}} and
quote {{CASE_REFERENCE}} before the date above.

CYPH/1 Privacy
```

Allow an operationally meaningful notice period unless the authorised legal
decision requires otherwise; do not lift first and notify afterwards.

## T11 — erasure completed in full

**Use:** Every in-scope active action is evidenced, and residual backup handling
is accurately explained.  
**Approval:** Privacy/legal decision owner; technical/data owner confirmation;
independent closure review.  
**Subject:** `Outcome of your CYPH/1 deletion request — {{CASE_REFERENCE}}`

```text
Hello,

We have completed the approved deletion actions for case
{{CASE_REFERENCE}}.

Deleted or irreversibly anonymised categories:
{{COMPLETED_ACTIONS}}

[IF MINIMAL SUPPRESSION DATA REMAINS]
We retain the minimum information needed to continue honouring your objection
to direct marketing. It is not used to send marketing.
[END IF]

[IF CONTROLLED BACKUP RESIDUALS EXIST]
Some residual copies remain temporarily in protected backups until
{{BACKUP_EXPIRY_OR_CRITERIA}}. They are beyond ordinary use and, if a restore is
required, the deletion/suppression decision must be reapplied before the data
can return to ordinary processing.
[END IF]

{{COMPLAINT_BLOCK}}

CYPH/1 Privacy
```

Use “in full” only when no in-scope category was retained/refused. Do not say
all copies are gone if controlled backup residuals remain.

## T12 — partial erasure and retained information

**Use:** Some categories were erased and others have an authorised basis for
retention.  
**Approval:** Privacy/legal decision owner; finance/other specialist as
applicable; independent review.  
**Subject:** `Outcome of your CYPH/1 deletion request — {{CASE_REFERENCE}}`

```text
Hello,

We have completed our assessment of the deletion request in case
{{CASE_REFERENCE}}.

Deleted or irreversibly anonymised:
{{COMPLETED_ACTIONS}}

Retained information and reasons:
{{RETAINED_CATEGORIES_AND_REASONS}}

The retained information is limited to the stated purpose and will be reviewed
or deleted according to {{RETENTION_PERIOD_OR_CRITERIA}}. It will not be used
for direct marketing where you have objected.

[IF RESTRICTION CONTINUES]
The following restriction remains in place: {{RESTRICTION_SCOPE}}.
[END IF]

{{COMPLAINT_BLOCK}}

CYPH/1 Privacy
```

“Financial records”, “legal reasons” or an unapproved warranty period are not
sufficient explanations. Give category-specific reasons without copying legal
advice.

## T13 — processor or backup action still completing

**Use:** CYPH/1 has made the relevant decision and completed what it can, but a
specific downstream technical action remains. This is a transparent update,
not automatic legal compliance or closure.  
**Approval:** Privacy owner and processor/technical owner.  
**Subject:** `Update on your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We are writing with an update on case {{CASE_REFERENCE}}.

Completed actions:
{{COMPLETED_ACTIONS}}

The following technical action is still completing:
{{OUTSTANDING_ACTIONS}}

[IF BACKUPS ARE INVOLVED]
The residual information is protected and beyond ordinary use while it follows
the controlled backup expiry or reconciliation process. It must not be restored
to ordinary use without the applicable privacy decision being reapplied.
[END IF]

We will provide our next update by {{NEXT_UPDATE_DATE}}. This update does not
state that the outstanding action is complete.

{{COMPLAINT_BLOCK_IF_REQUIRED}}

CYPH/1 Privacy
```

Do not use this template to disguise a missed deadline, unresolved legal
decision or slow processor. Escalate each of those separately.

## T14 — refusal, exemption or reasonable-fee decision

**Use:** An authorised case-specific decision permits full/partial refusal,
withholding or a reasonable fee.  
**Approval:** Privacy/legal decision owner and independent review.  
**Subject:** `Decision on your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We have assessed the following part of case {{CASE_REFERENCE}}:
{{REQUEST_PART_ASSESSED}}.

Our decision is: {{REFUSE_WITHHOLD_OR_FEE_DECISION}}.

Reason:
{{CASE_SPECIFIC_AUTHORISED_REASON}}

[IF PARTIAL RESPONSE]
We have still provided or completed the following parts:
{{COMPLETED_ACTIONS}}
[END IF]

[IF REASONABLE FEE IS AUTHORISED]
The fee is {{FEE_AND_CALCULATION}} and reflects the authorised administrative
cost basis. We will explain the approved payment and response process through
{{CONTACT_ROUTE}}.
[END IF]

You may ask CYPH/1 to review this decision by contacting {{CONTACT_ROUTE}}.
{{COMPLAINT_BLOCK}}

CYPH/1 Privacy
```

Do not use a stock assertion that a request is “manifestly unfounded” or
“excessive”. Record and explain the actual case-specific evidence. Withhold only
what the authorised decision permits and complete unaffected parts.

## T15 — no matching personal information after verified search

**Use:** Identity is sufficiently established and a documented reasonable and
proportionate search found no matching data in scope.  
**Approval:** Privacy owner and search reviewer.  
**Subject:** `Outcome of your CYPH/1 privacy request — {{CASE_REFERENCE}}`

```text
Hello,

We completed a reasonable and proportionate search for the personal information
covered by case {{CASE_REFERENCE}} using the verified information available to
us. We did not identify matching personal information within this scope:
{{SYSTEM_AND_PERIOD_SCOPE}}.

This does not mean CYPH/1 never held information outside the stated scope or
that another organisation does not hold information in its own right.

If you believe we may have missed a particular interaction, you may provide
additional context through {{CONTACT_ROUTE}} without sending passwords or full
payment-card details.

{{COMPLAINT_BLOCK}}

CYPH/1 Privacy
```

Do not use before verification where the message would reveal whether a person
or record exists.

## T16 — closure confirmation

**Use:** The runbook closure criteria pass, including downstream technical
confirmations or authorised residual controls.  
**Approval:** Request coordinator plus independent closure reviewer.  
**Subject:** `CYPH/1 privacy request completed — {{CASE_REFERENCE}}`

```text
Hello,

The actions and responses for case {{CASE_REFERENCE}} are now complete.

Summary:
{{COMPLETED_ACTIONS}}

[IF APPROVED RETENTION OR RESIDUAL CONTROL REMAINS]
Information that remains subject to an approved retention or residual control:
{{RETAINED_CATEGORIES_AND_REASONS}}
[END IF]

{{COMPLAINT_BLOCK}}

If you contact us about this matter, quote {{CASE_REFERENCE}}. Please do not
send passwords, full payment-card details or identity documents unless we
provide a specific approved secure route.

CYPH/1 Privacy
```

Customer silence, a sent response or a processor instruction alone is not
closure.

## Approval and version record

Keep the signed approval in the restricted governance system. Source control
contains only the provider-neutral text and role/date/version evidence:

```text
Template-pack version:
Privacy/legal approver role and date:
Accessibility reviewer role and date:
Security/secure-delivery reviewer role and date:
Approved controller contact route version:
Approved complaint block version/date:
Approved secure-delivery method/version:
Production use approved: yes/no
Next legal/content review:
```

Review immediately after a relevant legal/guidance change, complaint, incident,
failed delivery, inaccessible response, provider/channel change or evidence that
a template created confusion.

## Current-law references

- [ICO: A guide to subject access](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/subject-access-requests/a-guide-to-subject-access/)
- [ICO: Subject access response considerations](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/)
- [ICO: Right to rectification](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-rectification/)
- [ICO: Right to erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/)
- [ICO: Right to restrict processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-restrict-processing/)
- [ICO: Right to object](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-object/)
- [ICO: Respect people's direct-marketing preferences](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/respect-peoples-preferences/)

Check current law/guidance before approval and live use. Some ICO individual-
rights guidance states that it is under review following changes to UK data-
protection law.

