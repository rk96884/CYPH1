-- Growth Agent data lives in an isolated namespace within the existing PostgreSQL database.
-- Additive only: does not modify public commerce tables or grant access to the agent.
-- Role creation and privileges require a separate, environment-specific reviewed deployment.
CREATE SCHEMA IF NOT EXISTS growth;
REVOKE ALL ON SCHEMA growth FROM PUBLIC;

CREATE TABLE growth.research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('manual','creator_search','partner_search','seo_search')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  items_examined integer NOT NULL DEFAULT 0 CHECK (items_examined >= 0),
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE growth.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('creator','partner')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  source_url text NOT NULL CHECK (source_url ~* '^https?://[^[:space:]]+$'),
  source_checked_at timestamptz NOT NULL,
  -- Canonical source identity is prepared by the trusted ingestion service.
  source_key text NOT NULL CHECK (length(btrim(source_key)) BETWEEN 1 AND 256),
  review_status text NOT NULL DEFAULT 'research_only'
    CHECK (review_status IN ('research_only','needs_review','approved','rejected','archived')),
  qualification_score smallint NOT NULL DEFAULT 0 CHECK (qualification_score BETWEEN 0 AND 100),
  qualification_confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (qualification_confidence BETWEEN 0 AND 1),
  research_run_id uuid REFERENCES growth.research_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, source_key)
);
CREATE INDEX growth_prospects_review_idx ON growth.prospects (review_status, qualification_score DESC);
CREATE INDEX growth_prospects_run_idx ON growth.prospects (research_run_id);

CREATE TABLE growth.prospect_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES growth.prospects(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('relevance','ukAudience','engagement','brandFit','feasibility')),
  rating smallint NOT NULL CHECK (rating BETWEEN 0 AND 5),
  source_url text NOT NULL CHECK (source_url ~* '^https?://[^[:space:]]+$'),
  evidence_note text NOT NULL CHECK (length(btrim(evidence_note)) BETWEEN 1 AND 1000),
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, dimension)
);

CREATE TABLE growth.outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES growth.prospects(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','business_form','platform_message')),
  subject text,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','rejected','archived')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((approved_by IS NULL AND approved_at IS NULL) OR
         (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
-- Approval is documentation only; this schema intentionally contains no send queue.

CREATE TABLE growth.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 120),
  target_type text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX growth_audit_log_created_idx ON growth.audit_log (created_at DESC);

CREATE TABLE growth.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- HMAC-SHA256 of normalized contact identity with a private, separately held key;
  -- never store plaintext addresses here or use an unsalted/raw hash.
  contact_hmac text NOT NULL UNIQUE CHECK (contact_hmac ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK (reason IN ('opt_out','do_not_contact','legal_hold')),
  created_at timestamptz NOT NULL DEFAULT now()
);
