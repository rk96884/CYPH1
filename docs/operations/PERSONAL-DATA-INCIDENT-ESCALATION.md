# Personal-data incident escalation

**Status:** Engineering operating baseline; legal/privacy approval and production ownership are outstanding  
**Last engineering update:** 7 September 2026

## Purpose

Provide a fail-safe response when an event may have affected the confidentiality,
integrity or availability of personal data handled by CYPH/1. This procedure
supports prompt containment, evidence preservation, risk assessment and an
accountable notification decision. It is not legal advice and does not itself
authorise a report to a regulator or communication to affected people.

Use this procedure for suspected incidents as well as confirmed breaches. Do not
wait for proof before recording the time at which CYPH/1 first became aware of a
credible personal-data breach.

## Current data and processor scope

At the present pre-launch and private-commerce stage, potentially relevant
systems include:

- Brevo subscription, consent and suppression records;
- Cloudflare website-security, Turnstile, DNS and Access identity/audit data;
- Render application, deployment and PostgreSQL services;
- GitHub source, Actions and incident evidence;
- commerce customer email, address, order and consent records;
- payment webhook request bodies and provider references;
- fulfilment address snapshots, tracking references and future provider data;
- local reconciliation exports, screenshots and operator notes.

The exact controller/processor roles, contract contacts, sub-processors,
international transfers and notification terms must be recorded in a restricted
processor register before production. A future payment, fulfilment, support,
analytics or fraud provider joins this scope only after that register and this
procedure are reviewed.

## What counts as a suspected breach

Escalate any security failure that may lead to accidental or unlawful loss,
destruction, alteration, unauthorised disclosure of, or access to personal data.
Examples include:

- an unexpected Cloudflare Access allow decision or exposed assertion;
- a credential, database export, webhook body or customer record disclosed in
  source control, logs, email, chat or an issue;
- an account takeover, malicious access or excessive permission;
- customer information sent to the wrong recipient or fulfilment provider;
- data corruption, deletion, ransomware or loss of availability that prevents
  people exercising their rights or receiving a necessary service;
- a provider notifying CYPH/1 of a breach affecting CYPH/1 data.

An unavailable service is not automatically a personal-data breach. It becomes
one where personal data is lost, altered, exposed or made unavailable in a way
that may affect people.

## Ownership and communication boundary

For private staging, the CYPH/1 project owner coordinates technical containment
and records the awareness time. Before production, assign and test:

| Responsibility | Required owner |
| --- | --- |
| Incident command and technical containment | Named primary and independent backup |
| Privacy risk assessment and notification decision | Accountable privacy/legal owner |
| ICO communication | Specifically authorised controller representative |
| Affected-person communication and support | Customer-support/communications owner |
| Provider and insurer coordination | Named commercial/operations owner |

Keep names, telephone numbers, private email addresses, contract identifiers and
out-of-hours contacts in a restricted contact register, not this repository.
Only the authorised privacy/legal owner may approve a conclusion that a breach
is not reportable, an ICO report, or communication to affected people.

## Immediate response

1. Record a restricted incident identifier, the reporter, the UTC discovery
   time and the earliest credible **controller awareness time**. Do not reset the
   awareness clock as the investigation develops.
2. Notify the incident owner and privacy/legal owner using the private contact
   route. Mark the event **Critical** until exposure and impact are understood.
3. Contain with the least destructive effective action. This may include
   disabling checkout, suspending the affected service, removing an Access Allow
   policy, revoking a session, restricting a database role or rotating a
   compromised secret.
4. Preserve necessary logs and evidence before rotation or recovery. Do not
   delete or overwrite customer, order, payment, webhook, audit or provider
   records to conceal or simplify the incident.
5. Prevent further disclosure. Do not paste personal data, secrets, raw Access
   assertions, full webhook bodies or database exports into GitHub, ordinary
   email, chat or this repository.
6. If payment data or outcomes may be affected, also follow
   `PAYMENT-PROVIDER-OUTAGE.md`. Keep verified webhooks available only where doing
   so does not perpetuate the compromise.
7. If fulfilment data may be affected, stop unsafe provider dispatch/retry and
   follow `FULFILMENT-OUTAGE-AND-MANUAL-REVIEW.md`.
8. Ask each relevant processor to preserve evidence, contain the incident and
   provide its awareness time, affected data, locations, sub-processors,
   mitigations and continuing update cadence.

Do not contact affected people, the media or the ICO from an unapproved account
or before the authorised owner has made the notification decision. This does not
prevent urgent steps that directly protect a person from harm.

## Risk assessment and decision record

Start the assessment immediately, even where facts are incomplete. Record:

- what happened, cause if known, and whether it is continuing;
- systems, providers, environments and countries involved;
- categories and approximate number of affected people;
- categories and approximate number of affected personal-data records;
- whether the data was readable, encrypted, pseudonymised or recoverable;
- likely consequences for people, including identity fraud, financial loss,
  discrimination, distress, reputational harm, loss of confidentiality and loss
  of control;
- affected groups and any factors increasing vulnerability;
- likelihood and severity before and after containment;
- measures taken or proposed and their UTC times;
- the notification decision, approver, rationale and next review time.

Assess risk to people, not only risk to CYPH/1. New facts may change the
classification and must trigger a fresh documented decision.

## Notification decision and timetable

The privacy/legal owner must apply the current law and ICO guidance. The current
UK baseline is:

- if a risk to people's rights and freedoms is **likely**, notify the ICO without
  undue delay and, where feasible, within 72 hours after becoming aware;
- if that risk is unlikely, an ICO report is not required, but the decision and
  supporting assessment must still be documented;
- if the likely risk is **high**, notify affected people directly without undue
  delay, subject to a legally reviewed exception;
- if a complete ICO report cannot be made within the timeframe, report the
  available accurate information and provide further information in phases
  without undue delay; record reasons for any delay.

An ICO notification should include, as far as known:

- the nature of the breach and approximate people/record categories and counts;
- the privacy contact point;
- likely consequences; and
- measures taken or proposed to address and mitigate it.

Communication to affected people must be clear and in plain language and include
the nature of the breach, contact point, likely consequences and protective or
remedial measures. Give practical steps that help people protect themselves;
avoid speculation, blame and unsupported reassurance.

Consider contractual notices to processors/controllers, the insurer, law
enforcement, the National Cyber Security Centre, payment partners and other
regulators where relevant. An ICO report does not replace another required
notification.

## Breach register and evidence

Record every confirmed personal-data breach in a restricted breach register,
including incidents assessed as not reportable. The record must contain the
facts, effects, risk assessment, notification rationale, remedial action,
approvals and follow-up actions.

The repository may contain only privacy-safe evidence such as:

- the incident or exercise identifier;
- UTC timestamps and affected environment;
- safe event categories and request/correlation identifiers;
- containment and recovery actions;
- the accountable role that approved closure;
- confirmation that the restricted record exists.

Do not commit the breach register itself, affected identities, IP addresses,
addresses, provider payloads, Access logs or regulator-report drafts.

## Recovery and closure

1. Verify the compromised path is closed and rotated credentials cannot be
   reused.
2. Confirm database integrity, migrations, access grants, logs and relevant
   provider state with privacy-safe checks.
3. Reconcile orders, payments, refunds and fulfilments where applicable.
4. Restore one capability at a time under incident-owner approval; keep commerce
   disabled where the integrity or notification assessment remains uncertain.
5. Continue monitoring for recurrence and for evidence that changes the risk.
6. Record root cause, control improvements, owners and due dates.
7. Close only after the privacy/legal owner confirms that notification and
   follow-up duties are complete and the technical owner confirms stable
   recovery.

## Pre-production exercise and approval gates

- [ ] Assign primary and backup incident owners and an authorised privacy/legal
      decision-maker.
- [ ] Create the restricted incident-contact and processor registers.
- [ ] Verify every processor's breach-notification route and contractual timing.
- [ ] Create controlled ICO and affected-person communication templates.
- [ ] Approve a purpose-specific retention schedule for logs, webhook bodies,
      orders, addresses, exports, consent and breach evidence.
- [ ] Run a tabletop exercise using synthetic data, including the awareness
      clock, processor escalation, risk assessment and phased-report scenario.
- [ ] Confirm that evidence and communications remain accessible if the primary
      email, source-control or hosting account is unavailable.
- [ ] Obtain accountable legal/privacy approval before production commerce.

## Authoritative guidance

- [ICO: UK GDPR data breach reporting](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/)
- [ICO: Personal data breaches — a guide](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/)
- [ICO: Personal-data breach self-assessment](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach-assessment/)

ICO guidance notes that it is being reviewed following the Data (Use and Access)
Act 2025. The accountable owner must check the current guidance when an incident
occurs and during the final pre-launch review.
