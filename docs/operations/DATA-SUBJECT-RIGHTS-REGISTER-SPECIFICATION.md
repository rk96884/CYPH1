# Data-subject rights restricted-register specification

**Status:** Logical specification only; no production register or storage
system approved  
**Contains personal data:** This document does not; the future register will  
**Last engineering update:** 16 September 2026

## Purpose and boundary

Specify the minimum auditable case data needed to operate
`DATA-SUBJECT-RIGHTS-OPERATIONS.md` without turning the register into a second
customer database. This is a logical model, not a migration, spreadsheet or
authorisation to collect identity documents.

The live register must be access-controlled, encrypted, backed up, monitored
and held outside source control. GitHub issues/projects, ordinary email folders,
unrestricted chat and shared spreadsheets are not approved substitutes.

## Record model

### Case

| Field | Rule |
| --- | --- |
| `case_id` | Non-personal unique reference; safe for operational alerting |
| `received_at` | Authoritative timestamp and timezone |
| `received_channel` | Approved channel type; reference the restricted source rather than copying its content |
| `state` | One value from the runbook lifecycle |
| `rights` | Bounded set: access, rectification, erasure, restriction, objection, marketing objection, portability, other |
| `coordinator_role` | Role/reference, not a personal contact in exported evidence |
| `decision_owner_roles` | Required privacy/legal, finance, support and technical roles |
| `statutory_deadline` | Calculated timestamp/date with governing event recorded |
| `internal_target` | Earlier operational target |
| `deadline_basis` | Receipt, sufficient identity information, authority information or other authorised basis |
| `risk_flags` | Bounded flags such as identity doubt, third-party data, high-risk disclosure, missing owner, deadline risk or incident |
| `current_action` | Bounded next action and due time without personal data |
| `closure_at` | Set only after runbook closure criteria pass |
| `register_review_at` | Review/disposal trigger under the approved evidence-retention rule |

### Identity-verification event

| Field | Rule |
| --- | --- |
| `event_id`, `case_id`, `occurred_at` | Non-personal references and timestamp |
| `reason_for_check` | Why reasonable doubt existed and risk being controlled |
| `method_class` | Authenticated channel, matched-held-facts, approved document check or other bounded method |
| `assurance_outcome` | Pending, passed, failed or escalated |
| `reviewer_role` | Authorised role |
| `evidence_reference` | Restricted evidence location if necessary; never a secret answer or document embedded in the event |
| `evidence_disposal_at` | Short approved deletion/review trigger for temporary verification material |

### System search

| Field | Rule |
| --- | --- |
| `search_id`, `case_id` | Non-personal references |
| `system_purpose` | Bounded inventory category and approved system reference |
| `identifier_types` | Types used, such as verified email, internal customer ID or order ID; avoid exact values unless necessary |
| `owner_role` | Search owner |
| `searched_at` | Timestamp |
| `result` | Not applicable, no match, match, processor enquiry or unresolved |
| `result_scope` | Categories/field groups, not copied personal-data values |
| `evidence_reference` | Protected query/export/result evidence location |
| `temporary_copy_disposal_at` | Required review/deletion time |

### Decision

| Field | Rule |
| --- | --- |
| `decision_id`, `case_id`, `decided_at` | Non-personal references and timestamp |
| `right`, `system_purpose`, `data_category` | Bounded classifications |
| `outcome` | Disclose, redact, correct, erase, anonymise, restrict, retain, refuse, no data or pending |
| `reason_code` | Approved controlled vocabulary |
| `reason_detail` | Minimal rationale; reference privileged/legal advice rather than copying it |
| `authority_reference` | Approved rule, schedule, exception or decision evidence |
| `decision_owner_role`, `reviewer_role` | Authorised roles |
| `effective_at`, `review_or_expiry_at` | Action and future review control |

### Action and processor instruction

| Field | Rule |
| --- | --- |
| `action_id`, `case_id`, `decision_id` | Non-personal references |
| `action_type` | Search, disclose, correct, restrict, erase, suppress, notify recipient, processor instruction or verify |
| `target_system_role` | Approved internal system/provider alias; no credential or endpoint secret |
| `requested_at`, `due_at`, `completed_at` | Deadline evidence |
| `status` | Pending, acknowledged, completed, failed, ambiguous or exception |
| `actor_role` | Human/system role, with protected audit identity elsewhere |
| `idempotency_or_event_reference` | Non-secret technical reference where implemented |
| `confirmation_reference` | Protected provider/system evidence, not copied customer data |
| `residual_scope` | Bounded backup/exception category |
| `residual_review_at` | Owner-controlled follow-up |

### Communication

| Field | Rule |
| --- | --- |
| `communication_id`, `case_id` | Non-personal references |
| `purpose` | Acknowledgement, verification, clarification, extension, response, refusal, restriction-lift notice or follow-up |
| `template_version` | Approved content version |
| `delivery_channel_class` | Secure portal, verified email or other approved method |
| `sent_at`, `delivery_status`, `accessed_at` | Minimum delivery evidence |
| `recipient_verification_reference` | Protected reference; do not duplicate destination details |
| `package_version_or_digest` | Optional integrity evidence; assess whether it remains linkable personal data |
| `temporary_package_disposal_at` | Required deletion/review trigger |

### Backup/restore privacy-state event

| Field | Rule |
| --- | --- |
| `privacy_event_id` | Non-personal event reference |
| `case_id`, `decision_id` | Restricted links necessary to replay the decision |
| `event_type`, `effective_at` | Correct, erase, restrict, suppress or lift restriction |
| `system_scope` | Systems/categories to reconcile after a restore |
| `replay_selector_reference` | Minimum protected selector; it may still be personal data and needs its own retention/access rule |
| `replay_status`, `verified_at`, `reviewer_role` | Fail-closed recovery evidence |

## Prohibited content

Do not store in titles, alerts, routine exports or free-text summaries:

- full request/response bundles or database dumps;
- passwords, hashes, tokens, keys, sessions or recovery codes;
- full card numbers, security codes or bank credentials;
- identity-document images or verification answers;
- unnecessary names, email addresses, postal addresses, tracking references,
  collection codes or payment-provider references;
- another person's data;
- copied legal advice or privileged correspondence;
- raw provider logs or unrestricted screenshots; or
- erased data retained merely to prove it was erased.

If evidence must be preserved, store it in an approved restricted evidence
location and place only a reference, owner and disposal/review date in the
register.

## Access and separation

- Least privilege by role; search operators need not see legal advice and
  decision owners need not receive database credentials.
- Strong authentication and independent deputy coverage are mandatory.
- Read, export, change, approval and deletion events require immutable audit
  records and UTC timestamps.
- High-risk disclosure, refusal/exemption, irreversible deletion and closure
  require separation or independent review appropriate to team size.
- Routine alerts use `case_id`, state, deadline risk and owner role only.
- Register export is exceptional, field-allowlisted, encrypted, access-logged
  and deleted under a recorded disposal trigger.

## Retention and deletion

The register needs its own approved retention rule. Do not set one in code or
this document without privacy/legal approval. The schedule must distinguish:

- original request and final controller response;
- identity-verification evidence;
- temporary search/disclosure packages;
- decision/action audit evidence;
- processor confirmations;
- complaints, disputes or legal holds; and
- replay selectors or minimal suppression records needed to keep prior rights
  effective.

At expiry, delete or irreversibly anonymise by category using approved tooling.
Any hold must state owner, reason, scope and next review; it cannot preserve the
entire case indefinitely by default.

## Validation before production

Use synthetic records only to prove:

1. every lifecycle transition is authorised and audited;
2. missing ownership or overdue action fails visibly;
3. an operator cannot see fields outside their role;
4. alerts and exports omit prohibited data;
5. verification evidence and response packages reach their disposal trigger;
6. processor and residual-backup actions cannot be lost at response time;
7. closure fails while required actions remain ambiguous or pending;
8. a restore replays post-backup correction, restriction, erasure and
   suppression before release; and
9. audit evidence proves outcomes without retaining deleted personal data.

## Approval record

Keep the signed production approval in the restricted governance system and
record only role/date/version evidence in source control:

```text
Register specification version:
Approved storage system:
Privacy/legal approver role and date:
Security approver role and date:
Technical approver role and date:
Retention rule reference:
Access review completed:
Synthetic validation evidence reference:
Production use approved: yes/no
```

