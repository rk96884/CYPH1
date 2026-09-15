# Customer-data retention and deletion

**Status:** Draft operating procedure; legal/privacy, finance and processor approval outstanding  
**Scope:** CYPH/1 early-access data and future commerce customer data  
**Production gate:** Do not enable live commerce or automate deletion from this draft

## Purpose and decision rule

Keep personal data only for a documented purpose and review it when that purpose
ends. An erasure request is not an instruction to erase every linked financial
record, nor is an accounting obligation permission to keep all customer data
indefinitely. Decide by data category, purpose, lawful basis, retention trigger,
applicable hold and recipient. Erase or genuinely anonymise data that is no
longer required; pseudonymised IDs can remain personal data if relinkable.

This is an operational draft, not a final legal determination. The accountable
privacy/legal and finance owners must approve the schedule, confirm the current
UK rules and align the public privacy notice, contracts and processing records
before live customer orders. UK guidance distinguishes erasure from retention
required by law or for legal claims, and expects a justified, reviewed schedule.
See the [ICO storage-limitation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
and [ICO right-to-erasure guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).

## Current boundaries

- The public pre-launch form collects early-access email/consent data through
  Cloudflare and Brevo. The current public privacy notice says unconfirmed
  registrations are deleted after 30 days, confirmed subscriptions last until
  unsubscribe/withdrawal, and the list is reviewed after 24 months without
  engagement. Those commitments must be verified against actual Brevo and
  Cloudflare settings and practice; this document does not silently change the
  notice.
- The Render customer staging runtime has checkout, payment webhooks, payment
  provider and fulfilment disabled. Existing commerce database records are
  synthetic/development data, not a production retention test.
- The commerce schema has no approved erasure workflow, purge scheduler or
  demonstrated backup-deletion process. `customers.retention_review_at` is a
  nullable review field, not proof that a deletion job runs.
- The public privacy notice currently describes the pre-launch controller and
  purpose. It must be reviewed if company registration or live commerce changes
  the controller, purposes, recipients or retention wording.

### Early-access control check — 13 September 2026

- The project owner reports no workflows in Brevo Automations. The supplied
  Cloudflare screenshot for the `cyph1-early-access` Worker shows no cron
  triggers, queue consumers or email triggers. The repository Worker has no
  scheduled cleanup or deletion handler.
- The Worker calls Brevo's double-opt-in API. Brevo's published DOI guidance
  says an unconfirmed address is not added to the contact list, but its
  confirmation attempt and email remain in transactional logs; the confirmation
  link expires after 30 days. Link expiry is not proof that those logs are
  deleted. See [Brevo's DOI guidance](https://help.brevo.com/hc/en-us/articles/208733449-Double-opt-in-DOI-What-it-is-and-how-to-track-user-sign-ups).
- The project owner found three transactional logs from a controlled test. The
  Brevo email-retention screen showed **all senders**, **delete logs after one
  month** and **never store previews**; those selections persisted after a page
  reload. This verifies the displayed account setting, not a completed deletion
  or the treatment of every DOI/event-log data category. Brevo states that
  deletion can take up to 24 hours after the configured period and that preview
  changes are not retroactive. See [Brevo's retention-rule guidance](https://help.brevo.com/hc/en-us/articles/4415743225746-Configure-a-custom-retention-period-for-your-transactional-logs-and-email-previews).
- A one-month rule plus processing time does not demonstrate the notice's exact
  30-day deletion claim for every unconfirmed registration. No project-configured
  control has been demonstrated for the 24-month confirmed-subscriber inactivity
  review. Other DOI/event-log retention, provider backups and manual processes
  remain unverified.
- Treat the gap between the published notice and demonstrated practice as an
  urgent privacy-control issue. Have the accountable privacy owner verify
  actual data retention and approve either a tested control that fulfils the
  notice or a prompt, accurate notice correction. Do not assume that adding a
  Worker cron trigger alone would delete Brevo contacts.
- This check did not inspect contact records, change provider settings or
  delete personal data. Cloudflare observability/log-retention settings and
  Brevo provider backups remain unverified.

### Confirmed-contact review check — 14 September 2026

- The project owner reports three Brevo contacts from historic tests and
  confirmed that `Creation date` and `Engagement status` filters are available
  in CRM Contacts. The supplied screenshot shows the filter choices, not an
  applied 24-month result. No contact identifiers or records were retained in
  this procedure.
- The project owner subsequently applied `Creation date → More than → 24
  months` to the early-access list and reported **zero matching contacts**.
  This is a point-in-time age check, not evidence that a recurring review is
  operating. Creation date alone is not inactivity; the definition of
  `Unengaged` needs checking, particularly for never-mailed contacts. No Brevo
  automation has been configured.
- A manual review method and cadence are set out below. Its engagement and
  exception criteria still require privacy-owner approval before a deletion
  decision. Do not treat this draft as authority to delete or blocklist the
  historic test contacts.

### Manual confirmed-subscriber inactivity review

**Owner:** CYPH/1 project owner for the current pre-launch list. A named backup
and authorised privacy decision-maker remain to be assigned before production
handover. **Cadence:** first working day of each month, beginning 1 October
2026, and additionally on an erasure/withdrawal request. If the owner is
unavailable, record the missed review and escalate; do not silently defer it.
The 14 September 2026 baseline was zero contacts older than 24 months.

1. In Brevo CRM Contacts, load **only the CYPH/1 early-access list**. Apply
   `Creation date → More than → 24 months` and record the review date and
   count. This is a candidate screen, not an inactivity finding. Do not save a
   public export or place contact details in source control.
2. For any candidate, verify the confirmation date and look for an affirmative
   subscriber action within the previous 24 months: a recorded link click,
   direct reply, preference update or fresh explicit confirmation. Use only
   actions actually available and evidenced in the approved Brevo/support
   workflow. The latest verified affirmative action starts a new 24-month
   review window. If no action can be verified, classify the record as
   **review required**, not automatically inactive.
3. Do not treat Brevo's `Unengaged` status, absence of an open, or absence of
   campaigns as conclusive. Brevo says its unengaged criteria are configurable;
   email opens may be unavailable or unreliable. Never-mailed contacts require
   individual purpose and consent review rather than an inferred failure to
   engage. See [Brevo's segment-condition guidance](https://help.brevo.com/hc/en-us/articles/14902945335954-What-conditions-are-available-to-segment-my-contacts).
4. Check whether the contact has unsubscribed, withdrawn consent, requested
   erasure or is subject to an approved hold. Withdrawal/erasure requests follow
   the rights-request procedure immediately; do not wait for the monthly
   review. A hold needs a named owner, narrow reason and review date.
5. The authorised privacy owner decides whether to delete, suppress/minimise,
   retain for a documented purpose, or seek clarification. Record the outcome,
   reason, next review date and approver in a **restricted** register. Keep only
   a count-only monthly summary outside that register. No bulk deletion or
   automation is authorised by this procedure.

The first working day is an operational target, not a new legal retention
period. The privacy owner must approve the action criteria and ensure the
published notice reflects the approved treatment. [ICO storage-limitation
guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
calls for justified periods and review of data that is no longer needed.

### Safe verification sequence

1. In Brevo, inspect the early-access list and a **test address owned by the
   project**: establish whether a submitted-but-unconfirmed DOI address appears
   as a contact or only in transactional logs. Do not export or share the live
   contact list to answer this question. Record only the result, date and
   account screen/API reference in the restricted evidence register.
2. The Brevo transactional-email retention setting is confirmed as one month
   for all senders with new previews disabled. Check whether separate DOI/event
   logs or existing previews persist after link expiry, and ask Brevo support
   for written confirmation where the account interface is silent. Check
   provider backups separately; do not change the rule without an impact review.
3. Check Brevo's current contact attributes/segments and campaign activity
   definitions for a **24-month inactivity review**, including how newly
   subscribed or never-mailed contacts, unsubscribed/blocklisted contacts and
   consent evidence are excluded or handled. Produce a count-only dry run;
   do not activate a delete-contact automation. Brevo warns that contact
   deletion is irreversible and recommends retaining blocklisted contacts to
   prevent accidental re-marketing. See [Brevo's deletion guidance](https://help.brevo.com/hc/en-us/articles/5313915904914-Delete-contacts).
4. In Cloudflare, inspect Worker observability/logging, request-log retention
   and any analytics or security-event retention. The absence of cron triggers
   does not establish whether Cloudflare holds identifiable request data.
5. Have the accountable privacy owner decide the exact 30-day and 24-month
   treatment, including logs, suppression and exceptional holds. Then approve
   an accurate public-notice correction or a tested, monitored control that
   fulfils the existing wording. Preserve a dated decision and test evidence.

## Inventory and provisional schedule

“TBC” means no deletion interval is approved. Do not turn a possible statutory
minimum into a blanket period for every field. Record a purpose, trigger and
review date for each category in the restricted processing/retention register.

| Category and locations | Proposed treatment / trigger | Approval still needed |
| --- | --- | --- |
| Unconfirmed early-access registration in Brevo and associated form workflow | Apply the public notice's 30-day deletion commitment; verify provider behaviour and any separate security logs | Confirm Brevo deletion mechanism, Cloudflare retention and evidence |
| Confirmed early-access email, consent wording/version, source and timestamp in Brevo | Retain while subscribed; act on withdrawal/unsubscribe; review inactivity at 24 months as stated in the public notice | Define engagement, review action and minimal suppression evidence |
| Marketing suppression record | Retain only the minimum needed to prevent further marketing; do not re-add a withdrawn address via commerce activity | Approve identifier, access and review period |
| Commerce `customers`, `addresses`, `customer_consents` | Review by purpose and linked orders; remove unnecessary reusable contact/address data when no longer needed, subject to approved exceptions | Lawful basis, warranty/support needs, transaction linkage and technical method |
| `orders` and immutable delivery/billing snapshots, `order_items` | Assess financial, tax, consumer and claims needs separately; minimise address/contact detail when no longer necessary if legal records can remain accurate | Finance/legal schedule, trigger, minimum fields and safe transformation |
| `payments`, `refunds`, checkout sessions and provider identifiers | Preserve necessary transaction/reconciliation evidence while required; examine provider-hosted copies separately | Finance/legal schedule, Mollie contract and deletion capabilities |
| Raw `webhook_deliveries`, `webhook_events`, outbox, fulfilment and communication events | Shortest justified operational period after retry, reconciliation, support and audit needs; raw bodies and free-form payloads need explicit scrutiny | Category-specific periods and safe purge dependency plan |
| `audit_events`, Render/Cloudflare/GitHub/Brevo logs and incident evidence | Restrict, minimise and retain by security/accountability purpose; holds may override ordinary expiry | Processor settings, access, periods and legal-hold owner |
| Collection-point searches and browser location | Treat unsuccessful searches and raw coordinates as transient; do not build location history | Confirm final selector/aggregator data path and any unavoidable provider logging |
| Confirmed collection-point selection and point snapshot | Retain the provider-namespaced point and immutable public-location snapshot with the order for approved fulfilment/support/claims purposes | Define minimum fields, order-linked period and later minimisation |
| Shipping labels, pickup/collection codes and tracking events | Restricted access and shortest purpose-specific operational/claims period; do not expose through logs or permanent public URLs | Provider capability, exact period, deletion and backup behaviour |
| Proof of delivery/collection, photos, signatures or geolocation | Retain only where required for delivery evidence, support or claims; restrict more tightly than ordinary tracking status | Confirm enabled service fields, access, claims period and data-subject handling |
| Aggregator/carrier customer data and backups | Processor-specific deletion, rights-request and contract-exit treatment | Executed DPA, subprocessors, transfers, retention and deletion confirmation |
| Reconciliation CSVs, support attachments, local downloads and exports | Approved restricted storage only; delete transient copies once the task and any approved hold end | Location, owner, deletion confirmation and schedule |
| Render database backups, provider backups and restored test copies | Record backup lifecycle; put erased data beyond use where immediate removal is unavailable and prevent reintroduction on restore | Provider mechanisms, expiry, restore-suppression control and evidence |

For context, [GOV.UK says limited-company accounting records are generally kept
for six years from the end of the relevant financial year](https://www.gov.uk/running-a-limited-company/company-and-accounting-records),
with exceptions that can extend that period. If registered for VAT,
[VAT records generally require at least six years](https://www.gov.uk/charge-reclaim-record-vat/keeping-vat-records),
and particular schemes can require longer. These are review inputs, not an
approved CYPH/1 retention rule for every order field. Company status, VAT
position, tax point, warranty, claims and cross-border scheme use remain TBC.

## Handling an access, correction or erasure request

1. Record the request promptly in an approved restricted rights-request
   register, including receipt time, channel, requested scope, owner and due
   date. A request may arrive verbally or in writing and need not use legal
   terminology. Do not copy full customer records into a general issue.
2. Acknowledge through an approved channel. If identity is genuinely in doubt,
   ask only for proportionate verification; do not routinely demand identity
   documents. Restrict access to the case and any evidence.
3. Search the data inventory across Brevo, Cloudflare, Render commerce data,
   the payment/fulfilment providers when introduced, support mailboxes,
   exports, local copies and backups. Use a controlled identifier-matching
   process. Do not paste addresses or provider references into source control.
4. Separate marketing withdrawal from commerce erasure. Stop marketing promptly
   and preserve only an approved minimal suppression record; a purchase must
   never restore marketing consent.
5. For each matched category, record one outcome: erase, anonymise, correct,
   restrict pending review, or retain under a documented legal obligation or
   claims basis. Note the specific fields, reason, review/expiry trigger and
   decision owner. Do not use a blanket “financial record” exception for data
   that is not needed to meet that obligation.
6. Check for an active legal hold, tax enquiry, unresolved payment/refund,
   dispute, return, warranty claim or incident preservation requirement. A hold
   must have a named owner, reason, scope and review date; lift it when no longer
   justified.
7. Obtain the authorised privacy/legal and, for financial records, finance
   decision before irreversible commerce-database changes. There is currently
   no approved production erasure command. Do not run ad-hoc `DELETE`, cascade
   removal, snapshot rewriting or schema changes on a useful database.
8. Send scoped deletion/correction instructions to each relevant processor or
   recipient, and record acknowledgements or a justified exception. Confirm
   how backups and exports are handled. If a backup cannot be immediately
   overwritten, keep it beyond ordinary use until scheduled replacement and
   ensure a later restore does not resurrect erased data.
9. Verify completion through restricted, minimal evidence: affected systems,
   operation outcome, date, approver role, residual items, hold/review dates and
   provider confirmation. Do not retain the deleted data in the request log.
10. Respond to the individual with what was erased, what was retained and why,
    and any backup limitation, without disclosing another person's data. If the
    request is refused in whole or part, explain the reason and complaint route.

The [ICO says erasure responses are normally due without undue delay and within
one calendar month](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).
The deadline, any proportionate identity check and any permitted extension must
be calculated and recorded under current guidance; do not assume an extension
or wait for a processor before escalating a deadline risk.

## Scheduled retention review and safe deletion design

- Run the early-access monthly review above now; assign primary and backup
  owners for each future commerce system and review due records and holds
  monthly once live personal-data processing begins.
- Before implementation, build a dependency map from the migrations. `orders`
  holds address snapshots even if `addresses` changes; `communication_deliveries`
  references `customers`; payment, fulfilment and event records reference orders
  directly or by identifiers. Foreign keys do not authorise cascade deletion.
- Design field-level minimisation and purpose-specific expiry before a purge
  job. Preserve referential integrity, transaction history, idempotency and
  reconciliation; never turn a paid order into an orphan or erase evidence of a
  refund merely to satisfy a broad delete request.
- Test with synthetic records in an isolated non-production database, including
  shared customer/order links, pending payments, refunds, event retries, holds,
  backup restore and repeat execution. Prove no customer data is logged or
  emitted in a CSV/issue as deletion evidence.
- Production execution requires reviewed migrations/commands, dry-run counts,
  explicit approval, bounded batches, monitoring, rollback/restore planning and
  post-run reconciliation. This draft itself authorises none of those actions.

## Launch blockers and approvals

- Approve a category-level retention schedule and lawful-basis/exception
  decisions with privacy/legal and finance owners.
- Resolve the unverified early-access 30-day deletion and 24-month review
  commitments identified on 13 September 2026: verify provider behaviour,
  implement and test approved controls or correct the notice with privacy
  approval, including suppression and provider backup behaviour.
- Establish restricted rights-request and legal-hold registers, decision
  ownership, access controls and response templates.
- Review Render, Cloudflare, Brevo and later Mollie/fulfilment contracts,
  retention controls, exports and backup/restore practices.
- Implement and test an auditable, purpose-specific commerce deletion and
  backup-reintroduction control before handling real orders.
- Update and approve the public privacy notice and processing records before
  live commerce; the current notice covers only pre-launch registration.
- Complete the shipping data-flow, field-allowlist and provider retention gates
  in `SHIPPING-PRIVACY-AND-SECURITY.md` before enabling an aggregator or carrier.
