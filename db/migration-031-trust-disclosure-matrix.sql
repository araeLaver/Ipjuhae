-- Migration 031: add verification-level-aware disclosure policy matrix and package metadata.

ALTER TABLE trust_disclosure_policies
  ADD COLUMN IF NOT EXISTS verification_level SMALLINT NOT NULL DEFAULT 0;

UPDATE trust_disclosure_policies
   SET verification_level = 0
 WHERE verification_level IS NULL;

ALTER TABLE trust_disclosure_policies
  DROP CONSTRAINT IF EXISTS ck_trust_disclosure_stage_purpose_level;
ALTER TABLE trust_disclosure_policies
  DROP CONSTRAINT IF EXISTS ck_trust_disclosure_verification_level;
ALTER TABLE trust_disclosure_policies
  ADD CONSTRAINT ck_trust_disclosure_verification_level
    CHECK (verification_level BETWEEN 0 AND 2);

-- Drop the legacy 5-column unique constraint regardless of its auto-generated
-- name. PostgreSQL truncates auto names to 63 bytes, so the original became
-- trust_disclosure_policies_version_subject_type_recipient_ro_key rather than
-- the full ..._transaction_stage_purpose_key the earlier attempt tried to drop.
DO $$
DECLARE
  legacy_conname text;
BEGIN
  SELECT c.conname INTO legacy_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'trust_disclosure_policies'
    AND n.nspname = current_schema()
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname ORDER BY a.attname)
      FROM pg_attribute a
      WHERE a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    ) = ARRAY['purpose', 'recipient_role', 'subject_type', 'transaction_stage', 'version']::name[];

  IF legacy_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE trust_disclosure_policies DROP CONSTRAINT %I', legacy_conname);
  END IF;
END $$;

ALTER TABLE trust_disclosure_policies
  DROP CONSTRAINT IF EXISTS uq_trust_disclosure_policies_matrix;
ALTER TABLE trust_disclosure_policies
  ADD CONSTRAINT uq_trust_disclosure_policies_matrix
    UNIQUE (version, subject_type, recipient_role, transaction_stage, purpose, verification_level);

INSERT INTO trust_disclosure_policies
  (version, subject_type, recipient_role, transaction_stage, purpose, claim_rules, ttl_minutes, status, verification_level)
SELECT
  p.version,
  p.subject_type,
  p.recipient_role,
  p.transaction_stage,
  p.purpose,
  p.claim_rules,
  p.ttl_minutes,
  p.status,
  1
FROM trust_disclosure_policies p
WHERE p.verification_level = 0
  AND NOT EXISTS (
    SELECT 1 FROM trust_disclosure_policies existing
     WHERE existing.version = p.version
       AND existing.subject_type = p.subject_type
       AND existing.recipient_role = p.recipient_role
       AND existing.transaction_stage = p.transaction_stage
       AND existing.purpose = p.purpose
       AND existing.verification_level = 1
  );

INSERT INTO trust_disclosure_policies
  (version, subject_type, recipient_role, transaction_stage, purpose, claim_rules, ttl_minutes, status, verification_level)
SELECT
  p.version,
  p.subject_type,
  p.recipient_role,
  p.transaction_stage,
  p.purpose,
  p.claim_rules,
  p.ttl_minutes,
  p.status,
  2
FROM trust_disclosure_policies p
WHERE p.verification_level = 0
  AND NOT EXISTS (
    SELECT 1 FROM trust_disclosure_policies existing
     WHERE existing.version = p.version
       AND existing.subject_type = p.subject_type
       AND existing.recipient_role = p.recipient_role
       AND existing.transaction_stage = p.transaction_stage
       AND existing.purpose = p.purpose
       AND existing.verification_level = 2
  );

ALTER TABLE trust_disclosure_packages
  ADD COLUMN IF NOT EXISTS verification_level SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE trust_disclosure_packages
  ADD COLUMN IF NOT EXISTS disclosure_conditions JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE trust_disclosure_packages
   SET verification_level = 0
 WHERE verification_level IS NULL;

ALTER TABLE trust_disclosure_packages
  DROP CONSTRAINT IF EXISTS ck_trust_disclosure_package_verification_level;
ALTER TABLE trust_disclosure_packages
  ADD CONSTRAINT ck_trust_disclosure_package_verification_level
    CHECK (verification_level BETWEEN 0 AND 2);
