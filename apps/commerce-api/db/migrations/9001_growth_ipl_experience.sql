-- Additive IPL product-category research: never changes scores, contact status or commerce.
-- Only manually approved research evidence from public sources, not outcomes or endorsements.
CREATE TABLE growth.ipl_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES growth.prospects(id) ON DELETE CASCADE,
  policy_version integer NOT NULL CHECK (policy_version = 1),
  classification text NOT NULL CHECK (classification IN (
    'ipl_review_confirmed','ipl_coverage_confirmed','other_hair_removal_tech',
    'beauty_device_only','no_public_ipl_evidence_found','needs_verification')),
  device text CHECK (device IS NULL OR length(btrim(device)) BETWEEN 1 AND 100),
  technology text CHECK (technology IS NULL OR technology IN ('IPL','light_based_ipl','laser','other_beauty_device')),
  evidence_url text CHECK (evidence_url IS NULL OR evidence_url ~ '^https://[^[:space:]]+$'),
  published_at date,
  checked_at date NOT NULL,
  firsthand_test_confirmed boolean NOT NULL DEFAULT false,
  content_format text CHECK (content_format IS NULL OR content_format IN (
    'first_person_initial_impressions','hands_on_review','article_recommendation','product_feature','comparison')),
  evidence_note text NOT NULL CHECK (length(btrim(evidence_note)) BETWEEN 30 AND 750),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id,policy_version),
  CHECK ((classification IN ('needs_verification','no_public_ipl_evidence_found')
    AND device IS NULL AND technology IS NULL AND evidence_url IS NULL
    AND published_at IS NULL AND content_format IS NULL AND firsthand_test_confirmed=false)
    OR (classification NOT IN ('needs_verification','no_public_ipl_evidence_found')
    AND device IS NOT NULL AND technology IS NOT NULL AND evidence_url IS NOT NULL
    AND published_at IS NOT NULL AND published_at <= checked_at AND content_format IS NOT NULL)),
  CHECK (classification <> 'ipl_review_confirmed' OR
    (firsthand_test_confirmed AND technology IN ('IPL','light_based_ipl'))),
  CHECK (classification <> 'ipl_coverage_confirmed' OR technology IN ('IPL','light_based_ipl')),
  CHECK (classification <> 'other_hair_removal_tech' OR technology = 'laser'),
  CHECK (classification <> 'beauty_device_only' OR technology = 'other_beauty_device')
);
CREATE INDEX growth_ipl_experience_prospect_idx ON growth.ipl_experience(prospect_id);
REVOKE ALL ON growth.ipl_experience FROM PUBLIC;
-- Only in the specifically named development database, and only if the existing
-- restricted roles have already been provisioned. No privileges in production.
DO $$
BEGIN
  IF current_database() = 'cyph1_commerce_development' THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='growth_import_dev') THEN
      GRANT SELECT, INSERT ON growth.ipl_experience TO growth_import_dev;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='growth_read_dev') THEN
      GRANT SELECT ON growth.ipl_experience TO growth_read_dev;
    END IF;
  END IF;
END $$;
