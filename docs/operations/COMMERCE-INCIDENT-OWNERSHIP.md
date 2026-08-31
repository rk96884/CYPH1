# Commerce incident ownership and alert routing

**Status:** Staging operating baseline; production ownership is not approved  
**Last engineering update:** 31 August 2026

## Purpose

Turn a staging health, deployment or access signal into an accountable human
response without publishing personal contact details or weakening the private
operations boundary. This document covers the current protected staging
environment only.

## Ownership

| Responsibility | Staging owner | Backup | Production status |
| --- | --- | --- | --- |
| Monitor acknowledgement and initial triage | CYPH/1 project owner | Not assigned | Not approved |
| Render service recovery | CYPH/1 project owner | Not assigned | Not approved |
| Cloudflare Access and DNS review | CYPH/1 project owner | Not assigned | Not approved |
| Database connectivity and migration verification | CYPH/1 project owner | Not assigned | Not approved |
| Payment-provider incident decision | Not applicable to disabled staging commerce | Not assigned | Not approved |
| Customer support and regulatory escalation | Not assigned | Not assigned | Not approved |

Keep actual email addresses, telephone numbers, recovery contacts and provider
account identifiers in a private contact register. Do not commit them to this
repository.

The project currently has one accountable staging operator and no independent
backup. This is acceptable for private engineering exercises but is a launch
blocker for production commerce.

## Alert routes

| Signal | Primary route | Required operator action |
| --- | --- | --- |
| Scheduled `/health` or `/ready` failure | GitHub Actions **Commerce staging monitor** failure and repository-owner notification | Open the failed run, identify which generic check failed and begin staging triage. |
| Failed Render deploy or service failure | Render workspace owner notification and service event/log view | Confirm the deployed commit, service state and generic health result. |
| Unexpected Access allow/deny activity | Cloudflare Access audit logs | Confirm the identity is expected; fail closed if access may be unauthorised. |
| Database readiness failure | Failed `/ready` check plus Render/PostgreSQL state | Prevent mutations, restore connectivity and run schema verification before recovery sign-off. |

Do not send assertions, secret values, full request headers, customer records,
payment data or raw database exports through an alert channel.

## Staging response procedure

1. Acknowledge the visible alert in the provider that generated it.
2. Record the UTC start time, affected environment, signal and responding role.
3. Check `/health` and `/ready` independently at the direct Render origin.
4. Review the latest Render deploy/runtime event and the bounded application
   log entry. Use the server-generated request ID where available.
5. If Access is involved, review the Cloudflare decision without copying its
   identity, IP, assertion or account identifiers into a public issue.
6. Classify the event using
   `docs/operations/COMMERCE-STAGING-OBSERVABILITY.md`.
7. Recover using the least invasive reversible action. If a resumed Render
   service does not start, use **Restart service** and record the intervention.
8. Re-run **Commerce staging monitor** and require a successful result.
9. Verify an authenticated read-only request through Cloudflare Access and
   confirm the direct Render origin still rejects `/operations/*` without a
   valid assertion.
10. Record cause, recovery, end time and follow-up owner. Close no incident
    solely because the public status page appears green.

## Escalation rules

- Treat an authentication bypass, leaked credential/assertion or suspected
  personal-data exposure as **Critical**. Suspend the affected service or
  remove its Allow policy and begin the security incident process.
- Treat persistent unavailability, database failure or an unexpected allowed
  identity as **High**. Keep mutations disabled until independently verified.
- Treat failed deploys and recurring monitor failures as **Medium**, escalating
  them if recovery is not stable.
- Record isolated expected denials and deployment transitions as **Low** only
  after confirming that the security boundary remains intact.

No production response-time target, on-call rota or service-level objective is
approved. Those values require staffing and business approval before launch.

## Notification verification checklist

- [x] GitHub repository owner watches **Actions** failures for this repository.
- [x] A deliberately failed monitor run produces a visible GitHub notification.
- [x] Render owner notifications are enabled for failed deploys and service
      failures.
- [ ] A Render notification channel is tested without exposing a secret or
      customer record.
- [ ] Cloudflare Access audit events are available to the accountable operator.
- [ ] The private contact register identifies an accountable staging owner.
- [ ] An independent backup owner is assigned before production commerce.
- [ ] Production incident, customer-support and regulatory escalation contacts
      are approved before launch.

## Evidence recorded

On **31 August 2026**, the scheduled monitor's controlled incident drill
demonstrated a healthy baseline, expected failures during Render suspension and
successful recovery after an operator-assisted Render restart. The evidence is
recorded in `docs/operations/COMMERCE-STAGING-OBSERVABILITY.md`.

This proves staging detection and recovery visibility. It does not provide a
production on-call arrangement or approve public commerce.

The notification settings were reviewed on **31 August 2026**. GitHub Actions
email notifications were already configured for failed workflows, and Render
email notifications were already configured for service and deploy failures.
The monitor exposes a manual-only `simulate_failure` input so the GitHub route
can be tested without suspending Render or changing a secret. Keep this input
disabled during routine and scheduled checks.

Also on **31 August 2026**, a manual monitor run with `simulate_failure`
enabled failed at the intended test step and produced the expected GitHub
Actions email notification to the repository owner. No Render health request
was required for this test. This verifies the GitHub failure-notification
route; the separate Render notification-channel test remains outstanding.
