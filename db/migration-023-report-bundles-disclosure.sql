-- Migration 023: P0 patent trust implementation hardening
-- 목적:
-- - validation_values를 출처/기준일/검수상태가 있는 표준 검증값으로 확장
-- - 리포트 열람 시 공개결정(disclosure_decisions)을 스냅샷화
-- - 허용된 리포트를 report_bundles로 저장해 철회/만료/분쟁 회수 기반 마련

ALTER TABLE validation_values
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS source_authority TEXT,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS reason_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS consent_id UUID REFERENCES consents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(80),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE validation_values
    ADD CONSTRAINT validation_values_source_type_chk
    CHECK (source_type IN ('legacy', 'ocr', 'manual', 'external_api', 'reference', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE validation_values
    ADD CONSTRAINT validation_values_review_status_chk
    CHECK (review_status IN ('extracted', 'needs_review', 'confirmed', 'rejected', 'corrected', 'expired', 'disputed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE validation_values
    ADD CONSTRAINT validation_values_confidence_chk
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE validation_values
   SET observed_at = COALESCE(observed_at, created_at, NOW()),
       review_status = CASE
         WHEN status = 'valid' THEN 'confirmed'
         WHEN status = 'disputed' THEN 'disputed'
         WHEN status = 'stale' THEN 'expired'
         ELSE 'needs_review'
       END
 WHERE source_type = 'legacy';

CREATE INDEX IF NOT EXISTS idx_validation_values_source_type
  ON validation_values(source_type);

CREATE INDEX IF NOT EXISTS idx_validation_values_review_status
  ON validation_values(review_status);

CREATE INDEX IF NOT EXISTS idx_validation_values_valid_until
  ON validation_values(valid_until);

CREATE INDEX IF NOT EXISTS idx_validation_values_retention_until
  ON validation_values(retention_until);

CREATE TABLE IF NOT EXISTS disclosure_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_role VARCHAR(20),
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  target_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  consent_id UUID REFERENCES consents(id) ON DELETE SET NULL,
  access_log_id UUID REFERENCES access_logs(id) ON DELETE SET NULL,
  purpose VARCHAR(80) NOT NULL,
  contract_stage VARCHAR(40),
  requested_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  allowed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  result VARCHAR(20) NOT NULL,
  denial_reason VARCHAR(40),
  policy_version VARCHAR(80) NOT NULL DEFAULT 'p0-20260726',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$ BEGIN
  ALTER TABLE disclosure_decisions
    ADD CONSTRAINT disclosure_decisions_target_type_chk
    CHECK (target_type IN ('profile', 'reference', 'document', 'property', 'trade_hint'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE disclosure_decisions
    ADD CONSTRAINT disclosure_decisions_result_chk
    CHECK (result IN ('granted', 'denied', 'revoked', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_disclosure_decisions_owner
  ON disclosure_decisions(owner_user_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_decisions_viewer
  ON disclosure_decisions(viewer_user_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_decisions_target
  ON disclosure_decisions(target_type, target_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_disclosure_decisions_consent
  ON disclosure_decisions(consent_id);

CREATE TABLE IF NOT EXISTS report_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disclosure_decision_id UUID NOT NULL REFERENCES disclosure_decisions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(40) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  target_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  allowed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  report_snapshot JSONB NOT NULL,
  snapshot_version VARCHAR(80) NOT NULL DEFAULT 'p0-20260726',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$ BEGIN
  ALTER TABLE report_bundles
    ADD CONSTRAINT report_bundles_report_type_chk
    CHECK (report_type IN ('tenant_trust', 'landlord_trust', 'property_safety'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE report_bundles
    ADD CONSTRAINT report_bundles_target_type_chk
    CHECK (target_type IN ('profile', 'property'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE report_bundles
    ADD CONSTRAINT report_bundles_status_chk
    CHECK (status IN ('active', 'revoked', 'expired', 'superseded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_bundles_owner
  ON report_bundles(owner_user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_bundles_viewer
  ON report_bundles(viewer_user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_bundles_target
  ON report_bundles(target_type, target_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_bundles_status
  ON report_bundles(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_report_bundles_decision
  ON report_bundles(disclosure_decision_id);
