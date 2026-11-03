# Growth Intelligence — development IPL evidence rollout

## Change scope

This release adds a seventh table, `growth.ipl_experience`, and five **immutable version-1 public-source research records**. It presents source-backed IPL review classifications, device, publication date and explanatory note in the protected development dashboard. This does **not** alter any creator qualification score, confidence, review status, outreach permission, order, customer, payment, or production deployment.

Research sources: [IPL research JSON](research/ipl-experience-first-five.json) and [verification notes](research/IPL-EVIDENCE-VERIFICATION.md).

## Important order of operations

All three Actions workflows run on `main` **after the PR is merged**; merging alone neither changes any PostgreSQL database nor redeploys Render/Pages.

### 1. Apply the additive schema to development (manual)

Actions → **Development Growth schema migration**

- Run `action=plan`; confirm one pending migration, `9001_growth_ipl_experience.sql`.
- Review the output and execute `action=apply`, with `APPLY-DEVELOPMENT-GROWTH`.
- Expected: `growth.ipl_experience` created, tracked in `public.schema_migrations`; all other existing tables intact.
- The migration grants the existing **development-only** roles precisely: `growth_import_dev` SELECT+INSERT; `growth_read_dev` SELECT. It does not grant UPDATE/DELETE, commerce access or privilege to production roles. If the roles are missing, migration does not create them; stop and inspect.

### 2. Validate, then import five approved IPL research records (manual)

Actions → **Development Growth IPL evidence import**

- First run `action=plan` (confirmation blank). The JSON is loaded, validated and enumerated **without a database connection**.
- Then `action=apply`, confirmation `IMPORT-IPL-EVIDENCE-RESEARCH-ONLY`.
- The importer authenticates as existing `growth_import_dev`, validates development database and role grants, requires each of the five sources already in `research_only`, writes IPL evidence and audit entries in **one transaction**, and refuses mismatched existing evidence. It is idempotent and never edits original qualification scores or creator status.
- Expected first apply: **5 inserted**, 0 unchanged. Re-running identical input: 0 inserted, **5 unchanged**. No outreach is performed.

### 3. Independently verify database records

In Render, issue read-only queries against `cyph1_commerce_development`:

```sql
SELECT p.display_name,p.review_status,p.qualification_score,
       ix.classification,ix.device,ix.evidence_url
FROM growth.prospects p
JOIN growth.ipl_experience ix ON ix.prospect_id=p.id
ORDER BY p.display_name;

SELECT count(*)::integer AS total
FROM growth.audit_log
WHERE action='research.ipl_evidence_import';
```

Expected: 5 evidence records, all five original scores unchanged, 5 new IPL audit entries.

### 4. Deploy the **development-only** dashboard/API

- Existing Render development Growth API service: `cyph1-growth-api-development`.
- The service was deployed from the separate Codex development branch, with auto-deploy **disabled**. **Do not** change the service to `main` or trigger its deployment until new schema and import are verified, and the service source has the reviewed API changes.
- Deploy the reviewed `development-read-api.mjs` change from the approved branch through an explicit, separate development-only branch synchronization/release; no production Render deployment.
- Deploy the updated protected Growth page to the isolated Cloudflare Pages development preview, **not** `www.cyph1.co.uk`.
- Confirm the API is authenticated and responds with `iplExperience` for each prospect; ensure unauthorized requests still receive 401, invalid writes 405.
- Dashboard should show an IPL classification column and link to the original attributable source in the detail panel. For missing entries, it says “Not recorded,” not “Never reviewed.”

## Release acceptance

- Five creators still have original 24–30/100 scores, all `research_only`.
- Sascha: firsthand Ulike Air 10 IPL **initial impressions**, not a proven long-term review.
- Sharon: earlier Sensica Sensilight Mini IPL **coverage**, not a verified standalone treatment log.
- Nicola, Janet and Hanna: `needs_verification`, not false “no IPL experience.”
- Both database roles remain restricted; the reader has SELECT only.
- No outreach or production API/Pages deployment.
- GitHub CI and development dashboard smoke tests pass.

**Rollback:** Do not delete research automatically. If verification fails, stop new imports and revert the development API deployment to its prior commit while investigating. A schema/data correction requires explicit review and an auditable replacement policy version rather than silently updating version 1.
