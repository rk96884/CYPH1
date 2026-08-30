# Commerce threat model

**Engineering baseline:** 30 August 2026  
**Scope:** Private/test commerce API, hosted checkout, PostgreSQL, provider webhooks, fulfilment, communications and protected operations  
**Production status:** Disabled and not approved

## Assets and security objectives

Protect order and contact data, provider and database credentials, authoritative prices and totals, payment/refund state, fulfilment commands, operator identity and the audit trail. Card data must remain on the hosted payment-provider surface; CYPH/1 must not collect or store it.

## Trust boundaries

1. **Public or private browser → commerce API:** Treat product identifiers, quantities, addresses, redirects and displayed status as untrusted. Recalculate totals server-side and enforce the server feature gate.
2. **Commerce API → payment provider:** Send only authoritative totals through the configured server-side adapter. Keep credentials server-only and use bounded requests and idempotency keys.
3. **Payment provider → webhook endpoint:** Accept raw provider input only at the approved endpoint. Authenticate its meaning through the provider before changing state; browser redirects are never authoritative.
4. **Commerce API → PostgreSQL:** Use parameterised queries, transactions and constraints. Keep the connection URL out of builds, logs and browser variables.
5. **Identity proxy → operations handler:** Only verified middleware may construct an operator principal. The handler validates its shape and applies an explicit least-privilege permission for every action.
6. **Commerce API → fulfilment and communications:** Both consumers remain disabled by default. Commands and deliveries use durable idempotency records and exclude marketing consent from transactional decisions.
7. **Source and CI → deployments:** Pull requests receive no commerce secrets. Preview, test and future production credentials and data must remain separate.

## Principal threats and controls

| Threat | Existing or required control | Residual action before launch |
| --- | --- | --- |
| Price, tax or shipping tampering | Server-side calculation, integer minor units, database snapshots and constraints | Exercise the final approved catalogue and tax rules |
| Duplicate checkout, refund or fulfilment | Durable idempotency keys and provider keys | Verify each live provider's documented behaviour |
| Ambiguous provider timeout | `resolution_required`, amount reservation and reconciliation runbooks | Exercise in provider sandbox |
| Forged or replayed webhook | Approved endpoint, provider-authenticated lookup, atomic event deduplication | Independent provider-specific review |
| Privilege escalation in operations | Trusted-principal boundary, runtime principal validation and per-action permissions | Configure identity proxy groups and independently review mappings |
| Secret exposed in browser or source | Runtime `PUBLIC_` rejection, CI repository audit, `.gitignore` and secret stores | Review actual deployment inventories and rotate any exposed value |
| Personal data in exports or logs | Bounded reconciliation fields, formula-safe CSV, safe provider errors and audit summaries | Retention/logging review and sampled deployment-log inspection |
| Test system creates live side effect | Test-only Mollie key enforcement; manual fulfilment/communication adapters; disabled defaults | Separate deployment accounts/credentials and keep production gate closed |
| Database compromise or data loss | Private connection, least privilege, migrations and audit records | Backup restore rehearsal, retention approval and database access review |
| Dependency or CI compromise | Locked dependencies and read-only quality-workflow token | Dependency review and protected-branch/ruleset review |
| Denial of service or abusive checkout | Fail-closed provider handling | Add rate limiting and load/soak evidence before public checkout |

## Data minimisation

- Do not store raw card details, provider credentials, authentication tokens or unnecessary provider payloads.
- Do not include customer/address data in reconciliation CSV unless a separately reviewed operational need is established.
- Audit summaries contain identifiers, amounts, reasons and state changes only.
- Synthetic records only in local, preview and load testing.

## Review rule

This document records the engineering model, not launch approval. Any new provider, public endpoint, customer account capability, product claim, market or processor requires the model to be reviewed and dated again.
