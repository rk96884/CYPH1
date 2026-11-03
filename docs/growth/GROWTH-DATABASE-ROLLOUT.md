# Growth Agent PostgreSQL rollout

This phase reuses CYPH/1's **existing Render PostgreSQL database**, using a separate `growth` schema. It does **not** provision or require another Render database.

## What's included
- Additive migration: `apps/commerce-api/db/migrations/9000_growth_agent_foundation.sql`.
- Six tables: `research_runs`, `prospects`, `prospect_evidence`, `outreach_drafts`, `audit_log`, `suppression_list`.
- Database constraints for source URLs, channels, scoring, draft status and unique prospect identity.
- No email-sending worker, public routes, background scheduler, AI credentials or commerce-table alterations.
- The £74.99 launch price is a business assumption, **not** a persisted sales price or commission setting.

## Deployment steps (not performed in this PR)
1. Review backup/restore readiness and disk headroom, and rehearse on staging first.
2. Confirm that the existing `schema_migrations` ledger does not already use the `9000` prefix, and confirm any pending migrations before applying this one. The migration runner checks SHA-256 checksums and runs each file in a transaction.
3. Run the established `npm run db:migrate --workspace @cyph1/commerce-api` in the approved environment with its existing secured `DATABASE_URL` and `DATABASE_SSL` configuration. This executes **all pending migrations**, not just growth. Inspect that list before invoking it against production.
4. Run `node apps/commerce-api/scripts/verify-growth-schema.mjs` with the approved database environment variables. The verifier only reads schema metadata.
5. Confirm that orders, payments, fulfilment and customer routes remain healthy; verify the existing database backup/restore policy before storing any prospect data.

## Access-control follow-up (required before integrating agent jobs)
The migration revokes `PUBLIC` privileges on the new schema, but PostgreSQL schema owners may still access it. **Do not reuse the commerce application superuser/owner connection for the autonomous agent.**

Provision a dedicated login role through your restricted database administration process (not in this migration) and grant only:
- `USAGE` on schema `growth`;
- only the explicit table/sequence permissions needed for the research service;
- no permissions on commerce or public customer/payment tables;
- a limited connection pool, statement timeout and strong rotated secret.

Before allowing automated imports, verify effective permissions in PostgreSQL, including `public` schema defaults, and make sure the login has no membership in broader roles. `REVOKE` on the growth schema alone does not revoke access to existing commerce data from a reused privileged role.

## Privacy and operational boundaries
- Keep prospect records limited to public business/creator identifiers and documented evidence. Consumer discovery uses aggregate search signals, not individual prospect tracking.
- `suppression_list.contact_hmac` requires a keyed HMAC from a server-held secret; do not store raw addresses or unsalted digests.
- Apply retention and erasure policies before production imports.
- Draft approval does not send anything. Review UK PECR/UK GDPR obligations before any individual communication.
- All new growth tables are currently empty, and no real leads are ingested by this milestone.
