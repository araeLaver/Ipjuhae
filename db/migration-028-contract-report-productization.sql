-- Migration 028: contract check reports, Trust Cards, safe document intake,
-- AI processing evidence, validation experiments and B2B organization foundation.

CREATE TABLE IF NOT EXISTS trust_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  business_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  billing_plan TEXT NOT NULL DEFAULT 'pilot',
  created_by UUID NOT NULL REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_organization_type CHECK (
    organization_type IN ('broker_office', 'property_manager', 'institution', 'proptech', 'other')
  ),
  CONSTRAINT ck_trust_organization_status CHECK (
    status IN ('pending', 'active', 'suspended', 'closed')
  )
);

CREATE TABLE IF NOT EXISTS trust_organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES trust_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id),
  CONSTRAINT ck_trust_organization_member_role CHECK (
    member_role IN ('owner', 'admin', 'reviewer', 'broker', 'member')
  ),
  CONSTRAINT ck_trust_organization_member_status CHECK (
    status IN ('invited', 'active', 'suspended', 'removed')
  )
);

CREATE TABLE IF NOT EXISTS trust_organization_api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES trust_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_api_client_status CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE TABLE IF NOT EXISTS contract_check_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES trust_organizations(id),
  transaction_id UUID REFERENCES trust_transaction_contexts(id),
  property_id UUID REFERENCES properties(id),
  tenant_id UUID REFERENCES users(id),
  landlord_id UUID REFERENCES users(id),
  realtor_id UUID REFERENCES users(id),
  requester_role TEXT NOT NULL,
  title TEXT NOT NULL,
  contract_address TEXT,
  contract_stage TEXT NOT NULL DEFAULT 'pre_contract',
  status TEXT NOT NULL DEFAULT 'draft',
  public_summary TEXT,
  disclaimer_version TEXT NOT NULL DEFAULT '2026-07-13',
  ocr_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  api_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  review_minutes INTEGER NOT NULL DEFAULT 0,
  payment_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  storage_support_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_contract_report_requester_role CHECK (
    requester_role IN ('tenant', 'landlord', 'broker')
  ),
  CONSTRAINT ck_contract_report_stage CHECK (
    contract_stage IN ('application', 'screening', 'negotiation', 'pre_contract', 'signed', 'completed')
  ),
  CONSTRAINT ck_contract_report_status CHECK (
    status IN ('draft', 'in_review', 'ready', 'shared', 'revoked', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_contract_reports_owner
  ON contract_check_reports(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_reports_transaction
  ON contract_check_reports(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_reports_organization
  ON contract_check_reports(organization_id, created_at DESC) WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS contract_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES contract_check_reports(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'MISSING',
  evidence_id UUID REFERENCES trust_evidence_items(id),
  source_type TEXT,
  source_name TEXT,
  source_ref TEXT,
  source_observed_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  public_value JSONB,
  sensitivity TEXT NOT NULL DEFAULT 'restricted',
  missing_reason TEXT,
  next_action TEXT,
  review_state TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, subject_type, item_key),
  CONSTRAINT ck_contract_item_subject CHECK (
    subject_type IN ('tenant', 'landlord', 'property', 'broker')
  ),
  CONSTRAINT ck_contract_item_status CHECK (
    verification_status IN ('VERIFIED', 'REVIEW_REQUIRED', 'MISSING', 'EXPIRED', 'REJECTED')
  ),
  CONSTRAINT ck_contract_item_source CHECK (
    source_type IS NULL OR source_type IN (
      'upload', 'public_record', 'manual_review', 'partner_api', 'reference', 'direct_input'
    )
  ),
  CONSTRAINT ck_contract_item_sensitivity CHECK (
    sensitivity IN ('public', 'restricted', 'sensitive', 'prohibited')
  ),
  CONSTRAINT ck_contract_item_review CHECK (
    review_state IN ('pending', 'approved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_contract_items_report
  ON contract_check_items(report_id, subject_type, display_order);
CREATE INDEX IF NOT EXISTS idx_contract_items_review_queue
  ON contract_check_items(review_state, created_at) WHERE review_state = 'pending';

CREATE TABLE IF NOT EXISTS trust_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  report_id UUID NOT NULL REFERENCES contract_check_reports(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID,
  title TEXT NOT NULL,
  audience_role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  field_keys TEXT[] NOT NULL,
  share_token_hash CHAR(64) NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  disclaimer_version TEXT NOT NULL DEFAULT '2026-07-13',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_card_subject CHECK (
    subject_type IN ('tenant', 'landlord', 'property', 'broker', 'combined')
  ),
  CONSTRAINT ck_trust_card_audience CHECK (
    audience_role IN ('tenant', 'landlord', 'broker', 'institution', 'private_recipient')
  ),
  CONSTRAINT ck_trust_card_status CHECK (
    status IN ('issued', 'revoked', 'expired')
  ),
  CONSTRAINT ck_trust_card_fields CHECK (cardinality(field_keys) > 0)
);

CREATE INDEX IF NOT EXISTS idx_trust_cards_owner
  ON trust_cards(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_cards_report
  ON trust_cards(report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_card_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES trust_cards(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id),
  purpose TEXT,
  decision TEXT NOT NULL,
  ip_hash CHAR(64),
  user_agent TEXT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_card_access_decision CHECK (
    decision IN ('allowed', 'denied', 'expired', 'revoked')
  )
);

CREATE INDEX IF NOT EXISTS idx_trust_card_access_card
  ON trust_card_access_logs(card_id, accessed_at DESC);

CREATE TABLE IF NOT EXISTS document_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  storage_ref TEXT NOT NULL,
  source_kind TEXT NOT NULL DEFAULT 'user_upload',
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_engine TEXT,
  scan_signature_version TEXT,
  scanned_at TIMESTAMPTZ,
  quarantine_reason TEXT,
  extraction_job_id UUID REFERENCES trust_extraction_jobs(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, file_sha256, storage_ref),
  CONSTRAINT ck_document_intake_subject CHECK (
    subject_type IN ('tenant', 'landlord', 'property')
  ),
  CONSTRAINT ck_document_intake_source CHECK (
    source_kind IN ('user_upload', 'public_record', 'partner_api', 'operator_upload')
  ),
  CONSTRAINT ck_document_intake_scan CHECK (
    scan_status IN ('pending', 'scanning', 'clean', 'quarantined', 'failed')
  ),
  CONSTRAINT ck_document_intake_size CHECK (byte_size > 0)
);

CREATE INDEX IF NOT EXISTS idx_document_intake_scan_queue
  ON document_intakes(scan_status, created_at) WHERE scan_status IN ('pending', 'scanning', 'failed');

CREATE TABLE IF NOT EXISTS ai_processing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES trust_organizations(id),
  extraction_job_id UUID REFERENCES trust_extraction_jobs(id),
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT,
  policy_version TEXT,
  input_hash CHAR(64) NOT NULL,
  output_hash CHAR(64),
  contains_personal_data BOOLEAN NOT NULL DEFAULT FALSE,
  consent_id UUID REFERENCES data_consents(id),
  status TEXT NOT NULL DEFAULT 'requested',
  human_review_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_detail TEXT,
  cost_amount NUMERIC(12,4),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_ai_run_status CHECK (
    status IN ('requested', 'running', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT ck_ai_run_review CHECK (
    human_review_status IN ('pending', 'approved', 'corrected', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_review_queue
  ON ai_processing_runs(human_review_status, created_at)
  WHERE human_review_status = 'pending';

CREATE TABLE IF NOT EXISTS validation_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  experiment_type TEXT NOT NULL,
  target_segment TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  target_count INTEGER,
  actual_count INTEGER NOT NULL DEFAULT 0,
  success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_hypothesis JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'planned',
  starts_at DATE,
  ends_at DATE,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_validation_experiment_type CHECK (
    experiment_type IN ('interview', 'sample_report', 'internal_test', 'pilot', 'pricing', 'broker_repeat', 'security')
  ),
  CONSTRAINT ck_validation_experiment_status CHECK (
    status IN ('planned', 'running', 'completed', 'cancelled')
  ),
  CONSTRAINT ck_validation_counts CHECK (
    (target_count IS NULL OR target_count >= 0) AND actual_count >= 0
  )
);

CREATE TABLE IF NOT EXISTS trust_compliance_gates (
  gate_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  required_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_reference TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_compliance_gate_status CHECK (
    status IN ('pending', 'approved', 'blocked')
  )
);

INSERT INTO trust_compliance_gates (gate_key, label, status, required_evidence)
VALUES
  ('production_ocr', '운영 OCR 활성화', 'pending', '["비식별 샘플 정확도", "원문 대조 절차", "개인정보 처리 검토"]'::jsonb),
  ('external_data_access', '외부기관 자동조회', 'pending', '["기관 이용조건", "이용자 동의", "법률 검토", "장애 복구 시험"]'::jsonb),
  ('automated_scoring', '자동 점수 및 판정', 'blocked', '["차별 영향 검토", "설명 가능성", "법률 검토", "회귀시험"]'::jsonb),
  ('paid_pilot', '유료 파일럿', 'pending', '["가격 검증", "환불 기준", "책임 제한", "삭제 기준"]'::jsonb),
  ('b2b_api', '조직용 B2B API', 'pending', '["조직 권한", "제공 항목 법률 검토", "보안 점검", "감사로그"]'::jsonb),
  ('electronic_signature', '전자서명 연동', 'pending', '["공급자 계약", "서명 검증", "장애 복구", "보관 정책"]'::jsonb)
ON CONFLICT (gate_key) DO NOTHING;

