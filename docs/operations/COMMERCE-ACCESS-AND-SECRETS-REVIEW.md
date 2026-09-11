# Commerce access and secrets review

**Status:** Review worksheet; production commerce remains disabled  
**Last engineering update:** 10 September 2026

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

## Render staging inventory review — 10 September 2026

The project owner reviewed deployed variable names and account security for
both current Render staging services. No secret values were copied into the
repository.

| Control | Recorded result |
| --- | --- |
| Operations staging variables | The deployed names match the documented database and Cloudflare Access configuration; no unexpected or secret-bearing `PUBLIC_` variable is present. |
| Operations permissions | The current test grant remains limited to `orders:read`; no Mollie, fulfilment or email-provider credential is present. |
| Customer staging variables | The deployed names match the documented customer-runtime configuration; checkout, commerce, payment webhooks, payment provider and fulfilment remain disabled. |
| Customer staging credentials | No Mollie key, production credential or production customer-data connection is present. |
| Database connection | Both services use the intended Render staging/development database connection boundary. |
| Render account security | The project owner enabled two-factor authentication on the Render account on 10 September 2026. |

**Outcome:** the current Render staging variable-name inventory and account 2FA
check pass. Secret rotation provenance, an independent reviewer, production
separation and production access approval remain outstanding.

## Cloudflare staging access review — 10 September 2026

The project owner reviewed the account membership, Access application, DNS
records, early-access Worker secret names and unnecessary-token/service-token
exposure. No identities, Access audience, tokens or secret values were copied
into the repository.

| Control | Recorded result |
| --- | --- |
| Account membership | Only the expected account has access. |
| Operations Access application | The staging destination, named-identity Allow policy, 30-minute session, identity provider and absence of a Bypass policy match the documented boundary. |
| DNS boundary | Operations staging remains Cloudflare-proxied; customer commerce staging remains DNS-only; no unexpected commerce record was found. |
| Worker secrets | The expected Brevo and Turnstile encrypted secret names are present; no plaintext secret was identified. |
| Tokens | No unnecessary API or service token was identified. |
| Cloudflare account 2FA | Enabled by the project owner on 10 September 2026 after safely establishing the account password. |

**Outcome:** the current Cloudflare staging configuration and account 2FA review
pass. Production separation, independent review and final access approval
remain outstanding.

## GitHub repository access review — 10 September 2026

The project owner reviewed personal account security and the `CYPH1`
repository's collaborators, Actions secrets and variables, deployment
environment, workflow permissions, deploy keys, webhooks and installed apps.
No account identities or secret values were copied into the repository.

| Control | Recorded result |
| --- | --- |
| GitHub account security | Two-factor authentication and recovery arrangements are enabled and securely retained. |
| Repository access | Only expected access is present. |
| Actions configuration | The expected staging-origin secret and public signup/Turnstile variables are present; no credential is exposed as a public variable. |
| Deployment environment | The GitHub Pages environment and deployment branch boundary match the intended configuration; no unnecessary environment secret was found. |
| Workflow permissions | Default permissions and fork-secret handling match the least-privilege review criteria. |
| External access | No unexpected deploy key, webhook or installed GitHub App was found. |
| Default-branch protection | Active `Protect main` ruleset restricts deletion and blocks force-pushes without a bypass. |

**Outcome:** the current GitHub account, repository-access, secret-name and
workflow review passes, including the non-disruptive default-branch protection
baseline. Pull-request/status-check enforcement, an independent review and
production approval remain outstanding.

## Brevo account and integration review — 10 September 2026

The project owner reviewed Brevo account security, users, API and SMTP key
names, sender/domain configuration, transactional webhooks and connected
applications. No key value, contact record or account identity was copied into
the repository.

| Control | Recorded result |
| --- | --- |
| Account security and users | Two-factor authentication and expected-user access checks pass. |
| API key inventory | Only the expected Cloudflare early-access integration key is present. |
| SMTP key inventory | No unexpected or unnecessary key was identified. |
| Sender and domain configuration | Only the expected CYPH/1 sender/domain configuration is present. |
| Webhooks and integrations | No unexpected destination or connected application was found. |
| Source restriction | IP blocking remains unchanged because the Cloudflare Worker integration has no approved fixed-egress allowlist. |

**Outcome:** the current Brevo access and integration review passes. Key
rotation provenance, retention/privacy approval, an independent reviewer and
production access approval remain outstanding.

## Domain registrar review — 10 September 2026

The project owner reviewed the Cloudflare Registrar account and `cyph1.co.uk`
domain controls without recording account, nameserver, recovery or payment
details in the repository.

| Control | Recorded result |
| --- | --- |
| Registrar and account boundary | Cloudflare is the registrar and authoritative DNS provider; account 2FA is enabled and the preceding membership review passes. |
| Recovery, renewal and transfer controls | The registrar checks completed without an unexpected account, delegation, integration or domain-control issue. |
| DNSSEC | Enabled on 10 September 2026 and confirmed active by Cloudflare on 11 September 2026. |

**Outcome:** the current registrar, renewal/recovery and DNSSEC review passes.
An independent review and production ownership approval remain outstanding.

## Repository and production-build audit — 10 September 2026

- `npm run audit:commerce-security` passed across 226 tracked files.
- The ordinary production build completed with only the five intended public
  pre-launch routes; private commerce and operations routes were absent.
- A targeted scan of the generated build found no private commerce credential
  names, PostgreSQL connection pattern or Cloudflare Access team-domain
  pattern.

**Outcome:** the tracked-source and generated public-build secret boundary
passes. This does not replace review of deployed providers or production
artefacts.

## Review procedure

1. Run `npm run audit:commerce-security` and inspect the production build artefact.
2. Compare each deployed variable name with this inventory; do not copy values.
3. Confirm preview/test services cannot access production credentials or production customer data.
4. Review active users, service accounts, recovery methods and MFA in every system.
5. Sample logs, audit summaries and exports for credentials and unnecessary personal data.
6. Rotate any credential with uncertain provenance and record only the date and owner.
7. Attach accountable approvals to the launch-readiness record before enabling commerce.
