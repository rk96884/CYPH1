# Commerce access and secrets review

**Status:** Review worksheet; production commerce remains disabled  
**Last engineering update:** 31 August 2026

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

## Protected staging boundary verification — 31 August 2026

This verification covers the private commerce operations staging environment only. It is not production launch approval and does not enable public commerce.

| Control | Recorded result |
| --- | --- |
| Cloudflare Access boundary | The dedicated Cloudflare-proxied staging hostname is protected by a self-hosted Access application. |
| Allowed identity | Access is restricted to one named Cloudflare account identity. The address is intentionally omitted from this repository. |
| Session duration | 30 minutes. |
| Application grant | The named operator has `orders:read` only for this test. No mutation permissions were granted. |
| Protected request | The protected orders endpoint authenticated successfully and returned an empty orders collection. |
| Direct-origin request | The Render origin rejected an unauthenticated request with `Authentication required.` |
| Test data | No real customer or payment data was used. The verified endpoint contained no order records. |
| Database connectivity | The staging service successfully reached the development PostgreSQL database through its internal connection. |

### Log evidence

- A Render PostgreSQL log sample was reviewed on 31 August 2026.
- The sample contained routine authenticated database connections and checkpoints.
- No passwords, API keys, JWTs, Cloudflare assertions, email addresses, postal addresses, query bodies, payment data or exported customer records were present.
- Expected infrastructure metadata was present, including private network addresses and database/user identifiers; the raw sample has not been copied into this repository.
- A Cloudflare Access audit event from 31 August 2026 at 09:31:29 UTC was reviewed. It recorded a successful allowed login to the self-hosted commerce operations staging application through the configured Cloudflare identity connection.
- The audit event corresponded to the expected staging hostname and UK operator session. Its email address, user ID, public IP address, application ID and request ID have intentionally not been copied into this repository.
- Render web-service deployment/runtime logs from 31 August 2026 were reviewed. They showed the expected operations start command, successful service startup, publication on the staging hostname and port 10000 detection.
- The Render runtime sample contained no credentials, tokens, assertions, customer data or request payloads. It was a startup/deployment sample rather than an HTTP access log.
- Together with the protected-request result, direct-origin rejection and Cloudflare Access audit event above, the manual protected-staging boundary verification is complete. Production commerce remains disabled and separately gated.

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
