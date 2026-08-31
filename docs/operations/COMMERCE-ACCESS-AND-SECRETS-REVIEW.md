# Commerce access and secrets review

**Status:** Review worksheet; production commerce remains disabled  
**Last engineering update:** 30 August 2026

Record owners and completion dates without copying credentials, recovery codes, personal phone numbers or secret values into this file.

## Secret inventory

| System | Secret or credential class | Required location | Preview/test separated | Owner reviewed | Rotation evidence |
| --- | --- | --- | --- | --- | --- |
| Render commerce API | `DATABASE_URL` | Render encrypted environment | [ ] | [ ] | [ ] |
| Mollie test | `MOLLIE_API_KEY` | API runtime secret store | [ ] | [ ] | [ ] |
| Cloudflare early-access Worker | Brevo API and Turnstile secret keys | Worker encrypted secrets | [ ] | [ ] | [ ] |
| Cloudflare Access | Team domain, application audience and operator grant map | Protected Render operations runtime | [ ] | [ ] | [ ] |
| Future fulfilment provider | API/webhook credentials | API runtime secret store | [ ] | [ ] | [ ] |
| Future transactional email provider | API/webhook credentials | Consumer runtime secret store | [ ] | [ ] | [ ] |

Browser variables may contain endpoint URLs, presentation flags and public Turnstile site keys only. A variable whose name contains `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `API_KEY` or `DATABASE_URL` must never use the `PUBLIC_` prefix.

## Account and access review

| System | Minimum control | Account owner/date | Result |
| --- | --- | --- | --- |
| GitHub | MFA; protected main; least-privilege collaborators; deploy workflow permissions reviewed |  | [ ] |
| Cloudflare | MFA; least-privilege members; Worker/Page variables separated; audit activity reviewed |  | [ ] |
| Render | MFA; service/database access limited; internal database URL used by runtime |  | [ ] |
| Mollie | MFA; test/live roles separated; settlement/refund permissions reviewed |  | [ ] |
| Brevo | MFA; minimum sender/contact access; API key scoped and rotated |  | [ ] |
| Domain/DNS | MFA; registrar lock and recovery ownership reviewed |  | [ ] |

## Operations role mapping

Map verified identity-provider groups to only these application permissions:

| Permission | Intended role | Approved group | Reviewer/date |
| --- | --- | --- | --- |
| `orders:read` | Support/operations reader |  |  |
| `refunds:create` | Senior refund operator |  |  |
| `fulfilment:retry` | Fulfilment operator |  |  |
| `reconciliation:export` | Finance/reconciliation |  |  |

Do not accept an operator ID or permission list from browser JSON, headers under user control, query parameters or local storage. The authentication middleware must verify the upstream identity and construct the principal internally.

Use `docs/operations/PROTECTED-COMMERCE-STAGING.md` for the deployment and
negative-access checks. Record the actual operator and reviewer here without
copying the Access assertion, audience value or account recovery details.

## Review procedure

1. Run `npm run audit:commerce-security` and inspect the production build artefact.
2. Compare each deployed variable name with this inventory; do not copy values.
3. Confirm preview/test services cannot access production credentials or production customer data.
4. Review active users, service accounts, recovery methods and MFA in every system.
5. Sample logs, audit summaries and exports for credentials and unnecessary personal data.
6. Rotate any credential with uncertain provenance and record only the date and owner.
7. Attach accountable approvals to the launch-readiness record before enabling commerce.
