# Production Hyperdrive least-privilege review

Production Hyperdrive read-only identity was verified using `cyph1_hyperdrive_prod_worker`. No commerce-table grants have been authorised yet.

The proposed grants in `sql/production-worker-grants-review.sql` are scoped to the exact existing `PostgresCommunicationRepository`, `PostgresFulfilmentOutboxConsumer`, `PostgresFulfilmentRepository.reservePaidOrder`, `confirmProviderCreation`, `failProviderCreation`, and their audit insert paths. They deliberately exclude the operations endpoints for dispatch, returns and collection review, and avoid DELETE/TRUNCATE and schema creation privileges.

**Before grants are applied:**
1. Confirm origin TLS/certificate verification in the production Cloudflare Hyperdrive settings. A successful connection alone does not independently prove certificate verification.
2. Review that the new role is an intended privileged commerce-processing identity and not a general read-only role. Applying these permissions permits real order-state writes through any authenticated connection using the role, even if commerce flags remain off.
3. Review effective existing privileges including `PUBLIC` and other role memberships. PostgreSQL table/column privilege combinations can expand effective access; verify after grant.
4. Have a separate explicit user approval for applying this production SQL. No grants are applied by this PR.
5. Keep existing Cloudflare Worker entrypoint disconnected, Cron unset and all commerce flags disabled. The remaining K-803 compliance/GO-NO-GO and end-to-end crash-recovery checks still block live processing.

**Read-only access audit** (run via production PostgreSQL; outputs contain no secrets):

```sql
SELECT current_database();
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee='cyph1_hyperdrive_prod_worker' AND table_schema='public'
ORDER BY table_name, privilege_type;
SELECT has_schema_privilege('cyph1_hyperdrive_prod_worker','public','USAGE') AS schema_usage;
```

**No production change has been executed.**
