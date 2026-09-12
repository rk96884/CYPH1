# Synthetic personal-data incident tabletop

**Exercise ID:** `PDI-TTX-001`  
**Status:** Passed on 12 September 2026; no real incident or personal data  
**Scope:** Awareness, containment, evidence, processor escalation, risk
assessment, notification governance and recovery

## Safety boundary

This is a discussion-only exercise. Do not create a GitHub issue, upload a
file, change a live service, contact a processor, regulator or customer, or use
any real identity, address, account, credential or provider reference.

All people, records, download counts and events in the scenario are fictional.
Record roles and relative/UTC exercise times only. The tabletop cannot make a
legal notification decision or approve production ownership.

## Objectives

The exercise must demonstrate that the participant can:

1. identify the earliest credible controller-awareness time;
2. classify uncertainty conservatively and contain further disclosure;
3. preserve necessary evidence without reproducing exposed data;
4. distinguish application recovery from privacy-risk assessment;
5. escalate to processors and an authorised privacy/legal decision-maker;
6. maintain the 72-hour decision clock as facts change;
7. use phased reporting where a required decision cannot wait for complete
   information; and
8. close only after technical and privacy responsibilities are complete.

## Roles for this exercise

| Role | Exercise holder |
| --- | --- |
| Incident commander and technical containment | CYPH/1 project owner |
| Privacy/legal notification decision | Simulated external accountable owner; not yet appointed |
| Processor liaison | CYPH/1 project owner |
| Independent backup | Gap to be recorded; not yet appointed |

The absence of production owners is an expected finding, not permission for the
technical participant to make a legal conclusion.

## Scenario

At exercise time `T+00`, the project owner receives a credible report that a
reconciliation export was mistakenly attached to a publicly accessible project
ticket 35 minutes earlier. The fictional file contains 12 customer names,
email addresses, delivery addresses, order references and one payment-provider
reference per person. It contains no card data, account password, API key,
Access assertion or special-category data. It is not yet known whether anyone
downloaded it.

No such file or ticket exists. Refer to it only as `SIMULATED-EXPORT-01`.

## Facilitator injects

Deliver the injects in order. The participant responds before reading the next
one.

### Inject 1 — discovery

The report is credible, the ticket is publicly reachable and the attachment
appears downloadable. State the awareness time, initial severity and immediate
actions in priority order.

### Inject 2 — access evidence

At `T+20 minutes`, the hosting provider reports four anonymous attachment
downloads. Viewer identities and onward sharing cannot be established. The
public attachment has now been removed, but cached copies cannot yet be ruled
out.

### Inject 3 — bounded scope

At `T+50 minutes`, technical review finds no exposed credential, no application
or database compromise and no other affected export. The 12 fictional records
were readable and contain the fields described above. Explain the updated risk
assessment, processor requests and system state.

### Inject 4 — governance delay

At `T+4 hours`, the designated privacy/legal decision-maker is unavailable and
there is no appointed backup. Explain what must continue, what cannot be
concluded by engineering and how the original awareness time is preserved.

### Inject 5 — incomplete position

At `T+60 hours`, the processor confirms removal from the public ticket but
cannot prove that downloaded copies were deleted. The 12 fictional people have
not been contacted and no misuse has been reported. State what must be ready
before the 72-hour point and who must authorise it.

## Expected control checkpoints

The facilitator verifies that the complete response includes:

- controller awareness fixed at `T+00`, not the upload time and not reset by a
  later inject;
- initial Critical treatment while exposure is uncertain;
- prompt removal/restriction of public access after preserving bounded evidence;
- a restricted incident record and safe identifiers/timestamps, without a copy
  of the fictional export in source control or ordinary chat;
- preservation requests to the relevant processor and confirmation of removal,
  access evidence, caches, sub-processors and update cadence;
- confirmation that payment credentials were not exposed, without treating
  that fact as proof of no risk;
- assessment of phishing, fraud, distress, physical/privacy and loss-of-control
  consequences to people;
- no destructive database edits, unnecessary service outage or credential
  rotation where the scenario provides no compromise evidence;
- an authorised privacy/legal decision on ICO and affected-person notification,
  with a phased report prepared if required information remains incomplete;
- continuing documentation even if the final decision is not to notify; and
- explicit findings for missing backup ownership, restricted contacts,
  processor routes, communication templates and approved retention.

## Pass criteria

The exercise passes when every expected checkpoint is addressed, the response
uses no real data or live action, and gaps are retained as launch blockers. A
participant must not claim that notification is or is not legally required
without the authorised current-law assessment.

## Privacy-safe completion record

```text
Exercise ID: PDI-TTX-001
Exercise date: 12 September 2026
Participant role: CYPH/1 project owner / simulated incident commander
Exercise clock: relative T+00 to T+60 hours; no live incident clock
Awareness clock preserved: yes
Containment sequence adequate: yes
Evidence boundary maintained: yes
Processor escalation covered: yes
Changing risk assessed: yes
Notification governance and phased-report scenario covered: yes
Recovery/closure boundary covered: yes
Live systems or real data used: no
Result: passed
Open launch blockers: authorised primary and backup privacy/legal owners;
restricted contact and processor registers; verified processor notification
routes; approved communications; retention schedule; alternate-system access;
legal/privacy production approval
```

The participant initially used a High severity label, then correctly revised
the opening classification to Critical in accordance with the current runbook:
uncertain exposure remains Critical until bounded. The final response kept the
technical incident commander within authority, preserved the original
awareness time, recommended prompt authorised assessment without making a legal
decision, and retained missing backup ownership as a launch blocker.

Do not add names, contact details, exposed fields, raw logs or draft regulator
communications to this record.
