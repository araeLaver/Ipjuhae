-- Migration 022: 특허 반영 기반 신뢰도 엔진 보강
-- 목적:
-- - 원본자료/검증값 분리 저장
-- - 동의관리 기반 선택 공개 기반 확장
-- - 항목형 레퍼런스 설문 + 반론 정정
-- - 열람로그/거래조건 참고값 기초 구조
-- - 임대인·임차인·주택 3분리 산정 확장 기반 테이블

-- 기존 landlord_references 보완: 기존 데이터는 tenant 중심으로 동작하던 구조를 확장
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS subject_user_id UUID;

UPDATE landlord_references
SET subject_user_id = user_id
WHERE subject_user_id IS NULL;

ALTER TABLE landlord_references
  ALTER COLUMN subject_user_id SET NOT NULL;

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS subject_role VARCHAR(20);

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS reference_role VARCHAR(20) DEFAULT 'tenant';

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS target_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS reference_channel VARCHAR(20) DEFAULT 'manual';

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS consent_scope TEXT[] DEFAULT ARRAY[]::text[];

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS disclosed_fields TEXT[] DEFAULT ARRAY[]::text[];

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS evidence_record_id UUID;

DO $$ BEGIN
  ALTER TABLE landlord_references
    ADD CONSTRAINT landlord_references_subject_role_chk
    CHECK (subject_role IN ('tenant', 'landlord'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE landlord_references
    ADD CONSTRAINT landlord_references_reference_role_chk
    CHECK (reference_role IN ('tenant', 'landlord'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE landlord_references
    ADD CONSTRAINT landlord_references_reference_channel_chk
    CHECK (reference_channel IN ('manual', 'external', 'ocr', 'agent'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_landlord_references_subject_user
  ON landlord_references(subject_user_id);

CREATE INDEX IF NOT EXISTS idx_landlord_references_subject_role
  ON landlord_references(subject_role);

CREATE INDEX IF NOT EXISTS idx_landlord_references_reference_role
  ON landlord_references(reference_role);

CREATE INDEX IF NOT EXISTS idx_landlord_references_target_property
  ON landlord_references(target_property_id);

CREATE INDEX IF NOT EXISTS idx_landlord_references_channel
  ON landlord_references(reference_channel);

-- 레퍼런스 항목형 응답값(구조화 검증값)
CREATE TABLE IF NOT EXISTS reference_response_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES reference_responses(id) ON DELETE CASCADE,
  item_code VARCHAR(64) NOT NULL,
  item_score SMALLINT CHECK (item_score BETWEEN 1 AND 5),
  item_comment TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(response_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_reference_response_items_response
  ON reference_response_items(response_id);

CREATE INDEX IF NOT EXISTS idx_reference_response_items_code
  ON reference_response_items(item_code);

-- 반론/정정 요청
CREATE TABLE IF NOT EXISTS reference_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES reference_responses(id) ON DELETE CASCADE,
  response_item_id UUID REFERENCES reference_response_items(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(32) NOT NULL DEFAULT 'correction',
  request_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  request_reason TEXT NOT NULL,
  requested_value JSONB,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(response_id, requester_user_id, request_type)
);

DO $$ BEGIN
  ALTER TABLE reference_disputes
    ADD CONSTRAINT reference_disputes_request_type_chk
    CHECK (request_type IN ('correction', 'objection', 'appeal'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE reference_disputes
    ADD CONSTRAINT reference_disputes_request_status_chk
    CHECK (request_status IN ('pending', 'reviewing', 'resolved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reference_disputes_response
  ON reference_disputes(response_id);

CREATE INDEX IF NOT EXISTS idx_reference_disputes_requester
  ON reference_disputes(requester_user_id);

CREATE INDEX IF NOT EXISTS idx_reference_disputes_status
  ON reference_disputes(request_status);

-- 선택 공개 동의
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewer_role VARCHAR(20),
  resource_type VARCHAR(30) NOT NULL DEFAULT 'profile',
  resource_id UUID,
  allowed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  allowed_purposes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  can_view_contact BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, viewer_user_id, viewer_role, resource_type, resource_id, valid_from)
);

DO $$ BEGIN
  ALTER TABLE consents
    ADD CONSTRAINT consents_viewer_role_chk
    CHECK (viewer_role IN ('tenant', 'landlord', 'admin', 'broker', 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE consents
    ADD CONSTRAINT consents_resource_type_chk
    CHECK (resource_type IN ('profile', 'reference', 'property', 'document', 'trade_hint', 'all'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_consents_owner
  ON consents(owner_user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_consents_viewer_user
  ON consents(viewer_user_id);

CREATE INDEX IF NOT EXISTS idx_consents_viewer_role
  ON consents(viewer_role);

-- 원본 자료(원본파일) 저장
CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID,
  document_type VARCHAR(80) NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_hash TEXT,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'raw_uploaded',
  extraction_payload JSONB,
  validated_payload JSONB,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE evidence_records
    ADD CONSTRAINT evidence_records_purpose_chk
    CHECK (purpose IN ('reference', 'tenant_verification', 'landlord_verification', 'property_verification', 'manual_check'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE evidence_records
    ADD CONSTRAINT evidence_records_target_type_chk
    CHECK (target_type IN ('profile', 'reference', 'property', 'match', 'document'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE evidence_records
    ADD CONSTRAINT evidence_records_extraction_status_chk
    CHECK (extraction_status IN ('raw_uploaded', 'ocr_pending', 'ocr_complete', 'ocr_failed', 'validated', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_records_owner
  ON evidence_records(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_target
  ON evidence_records(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_evidence_records_status
  ON evidence_records(extraction_status);

-- 원본 대비 계약판정용 검증값(노출 가능한 데이터)
CREATE TABLE IF NOT EXISTS validation_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type VARCHAR(30) NOT NULL,
  subject_id UUID,
  validation_key VARCHAR(80) NOT NULL,
  validation_score INTEGER,
  validation_numeric NUMERIC(14,4),
  validation_text TEXT,
  validation_flag TEXT,
  status TEXT NOT NULL DEFAULT 'valid',
  source_evidence_id UUID REFERENCES evidence_records(id) ON DELETE SET NULL,
  source_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE validation_values
    ADD CONSTRAINT validation_values_subject_type_chk
    CHECK (subject_type IN ('tenant', 'landlord', 'property', 'reference'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE validation_values
    ADD CONSTRAINT validation_values_status_chk
    CHECK (status IN ('valid', 'needs_review', 'disputed', 'stale'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_validation_values_owner
  ON validation_values(owner_user_id, subject_type);

CREATE INDEX IF NOT EXISTS idx_validation_values_key
  ON validation_values(subject_type, validation_key);

CREATE INDEX IF NOT EXISTS idx_validation_values_status
  ON validation_values(status);

-- 열람 로그(감사/분쟁 근거)
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  target_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  allowed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  purpose VARCHAR(30),
  ip_address VARCHAR(45),
  user_agent TEXT,
  contract_stage VARCHAR(30),
  result TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE access_logs
    ADD CONSTRAINT access_logs_target_type_chk
    CHECK (target_type IN ('profile', 'reference', 'document', 'property', 'trade_hint', 'admin_check'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_access_logs_viewer
  ON access_logs(viewer_user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_logs_owner
  ON access_logs(owner_user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_logs_target
  ON access_logs(target_type, target_id);

-- 주택 안전 점수(분리 산정용)
CREATE TABLE IF NOT EXISTS property_safety_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  safety_score INTEGER NOT NULL DEFAULT 0 CHECK (safety_score BETWEEN 0 AND 120),
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_safety_scores_property
  ON property_safety_scores(property_id);

-- 거래조건 추천값(양측 신뢰 조합 기반)
CREATE TABLE IF NOT EXISTS trade_condition_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  landlord_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  hint_level VARCHAR(20) NOT NULL DEFAULT 'normal',
  required_documents TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  adjustment_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_actions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE trade_condition_hints
    ADD CONSTRAINT trade_condition_hints_hint_level_chk
    CHECK (hint_level IN ('low', 'normal', 'high', 'critical'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_trade_condition_hints_tenant
  ON trade_condition_hints(tenant_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_condition_hints_landlord
  ON trade_condition_hints(landlord_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_condition_hints_property
  ON trade_condition_hints(property_id, updated_at DESC);
