# Controlled Growth research import — development only

This milestone supplies a **manual, dry-run-first** way to score verified public-source research, de-duplicate it and write it to the isolated `growth` tables. It does **not** search the internet itself, scrape profiles, gather personal contact information, approve outreach, send messages or touch customer/order/payment tables.

## Review input format
Create an untracked JSON file outside the repository or in a git-ignored working location:

```json
{
  "prospects": [
    {
      "name": "Example — not a real prospect",
      "channel": "creator",
      "sourceUrl": "https://example.org/profile",
      "sourceCheckedAt": "2026-11-03T12:00:00Z",
      "evidence": {
        "relevance": {
          "rating": 4,
          "sourceUrl": "https://example.org/article",
          "note": "Example evidence description, not a real endorsement"
        }
      }
    }
  ]
}
```

*Only insert verified real public-source data.* Never import the example into a real database. Each prospect requires at least one source-backed scoring dimension. A batch is limited to 25 records and 128 KiB. No contact fields are imported.

## Dry run (zero database access)

```powershell
node tools/growth-agent/import-reviewed.mjs C:\\secure\\approved-research.json
```

Inspect the scores, sources and confidence. Dry run requires neither a database connection nor a research-provider key.

## Scoped database permissions
**Do not use the commerce application's production or development database owner URL** for the importer. Provision a *separate dedicated login* in the **development database** through your approved PostgreSQL administrator and store its URL privately. The importer refuses a database whose name does not include `development`, a role not prefixed `growth_import_`, or missing explicit development mode.

Suggested grant plan for review by your database administrator (adapt existing role ownership/security and secret storage):

```sql
-- Administrator-managed in DEVELOPMENT only; select a strong random password
-- through the secret manager, not in source control or saved SQL files.
CREATE ROLE growth_import_dev LOGIN;
GRANT CONNECT ON DATABASE cyph1_commerce_development TO growth_import_dev;
GRANT USAGE ON SCHEMA growth TO growth_import_dev;
GRANT SELECT, INSERT ON growth.research_runs, growth.prospects,
  growth.prospect_evidence, growth.audit_log TO growth_import_dev;
GRANT UPDATE (status, completed_at) ON growth.research_runs TO growth_import_dev;
GRANT USAGE ON SEQUENCE growth.audit_log_id_seq TO growth_import_dev;
-- No privileges on public commerce tables, outreach drafts or suppression list.
```

`growth_import_dev` can be renamed to an account-approved `growth_import_...` identifier. Validate actual permissions before connecting, including that this identity cannot read commerce customers, orders or payments. Existing roles and default schema grants should be reviewed separately; the sample SQL is not executed by CI or by this PR.

```powershell
$env:GROWTH_IMPORT_DATABASE_URL = "<private development URL using growth_import_dev>"
$env:GROWTH_IMPORT_ENV = "development"
$env:GROWTH_IMPORT_DATABASE_SSL = "true" # if connecting externally with TLS
node tools/growth-agent/import-reviewed.mjs C:\\secure\\approved-research.json --apply --confirm=IMPORT-REVIEWED-RESEARCH
```

Never paste the URL into ChatGPT, commits, issues or GitHub Actions logs. The importer uses a transaction and audits inserted records. An existing `(channel, source_key)` is skipped and never overwrites a human review decision. The resulting `review_status` is always `research_only`; outreach stays disabled. The database is not contacted unless both `--apply` and the confirmation are provided.

## Production boundary
No production-writing feature is shipped. Production growth tables remain untouched. The current branded dashboard reads production operations data; it will continue to display zero until a separate production rollout is reviewed, the dedicated production role is provisioned, and import preflight/backup is approved.

## Quality checks
```sh
node --test tools/growth-agent/ingest.test.mjs
node --test tools/growth-agent/qualification.test.mjs
```

Next: test a few real sources in development; verify database grants, audit entries, dashboard readout on a protected staging API; only then propose an explicit production import workflow and retention/suppression policies.
