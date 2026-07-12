-- Migration 024: patent-aligned evidence, disclosure, trust graph and correction engine
-- Implements the persistence layer for inventions A1-A4 and platform functions F-01-F-16.

CREATE TABLE IF NOT EXISTS trust_source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(160) NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  authority VARCHAR(160),
  allowed_fields TEXT[] NOT NULL DEFAULT '{}',
  reliability NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  legal_basis TEXT,
  terms_reviewed_at TIMESTAMPTZ,
  retention_days INTEGER NOT NULL DEFAULT 30,
  automation_level VARCHAR(20) NOT NULL DEFAULT 'manual',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_source_type CHECK (source_type IN ('upload', 'direct_input', 'public_record', 'partner_api', 'ocr', 'manual_review')),
  CONSTRAINT ck_trust_source_status CHECK (status IN ('active', 'disabled', 'legal_hold')),
  CONSTRAINT ck_trust_source_reliability CHECK (reliability BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS trust_evidence_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  property_id UUID,
  source_id UUID NOT NULL REFERENCES trust_source_registry(id),
  document_id UUID,
  object_hash VARCHAR(64) NOT NULL,
  storage_ref TEXT,
  issued_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  state VARCHAR(20) NOT NULL DEFAULT 'VALID',
  consent_id UUID REFERENCES data_consents(id) ON DELETE SET NULL,
  extraction_confidence NUMERIC(5,4),
  human_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_evidence_subject CHECK (subject_type IN ('tenant', 'landlord', 'property')),
  CONSTRAINT ck_trust_evidence_state CHECK (state IN ('VALID', 'EXPIRED', 'CONFLICT', 'CORRECTED', 'REPLACED', 'DELETED', 'HELD')),
  CONSTRAINT ck_trust_evidence_confidence CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  UNIQUE (subject_type, subject_id, object_hash)
);

CREATE TABLE IF NOT EXISTS trust_fact_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES trust_evidence_nodes(id) ON DELETE RESTRICT,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  property_id UUID,
  field_name VARCHAR(100) NOT NULL,
  normalized_value JSONB NOT NULL,
  value_digest VARCHAR(64) NOT NULL,
  quality NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  valid_until TIMESTAMPTZ,
  supersedes_id UUID REFERENCES trust_fact_nodes(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_fact_subject CHECK (subject_type IN ('tenant', 'landlord', 'property')),
  CONSTRAINT ck_trust_fact_status CHECK (status IN ('ACTIVE', 'STALE', 'DISPUTED', 'CONFIRMED', 'REVISED', 'SUPERSEDED', 'HELD')),
  CONSTRAINT ck_trust_fact_quality CHECK (quality BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_trust_fact_subject_active
  ON trust_fact_nodes (subject_type, subject_id, field_name, created_at DESC)
  WHERE status IN ('ACTIVE', 'CONFIRMED', 'REVISED');

CREATE TABLE IF NOT EXISTS trust_derived_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type VARCHAR(30) NOT NULL,
  subject_type VARCHAR(20),
  subject_id UUID,
  transaction_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  state VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  output_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  reproduction_hash VARCHAR(64) NOT NULL,
  policy_version VARCHAR(80),
  model_version VARCHAR(80),
  supersedes_id UUID REFERENCES trust_derived_nodes(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_derived_type CHECK (object_type IN ('evaluation', 'recommendation', 'disclosure', 'application', 'offer', 'contract_condition', 'report', 'trust_graph')),
  CONSTRAINT ck_trust_derived_state CHECK (state IN ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'RECOMPUTING', 'REPUBLISHED', 'SUPERSEDED', 'REVOKED', 'HIDDEN', 'QUARANTINED'))
);

CREATE TABLE IF NOT EXISTS trust_dependency_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_type VARCHAR(20) NOT NULL,
  from_node_id UUID NOT NULL,
  to_node_type VARCHAR(20) NOT NULL,
  to_node_id UUID NOT NULL,
  dependency_type VARCHAR(20) NOT NULL DEFAULT 'required',
  created_by_run UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_dependency_type CHECK (dependency_type IN ('required', 'optional', 'explanation', 'disclosure_control')),
  UNIQUE (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_trust_dependency_reverse
  ON trust_dependency_edges (from_node_type, from_node_id);
CREATE INDEX IF NOT EXISTS idx_trust_dependency_forward
  ON trust_dependency_edges (to_node_type, to_node_id);

CREATE TABLE IF NOT EXISTS trust_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type VARCHAR(20) NOT NULL,
  node_id UUID NOT NULL,
  change_type VARCHAR(30) NOT NULL,
  old_digest VARCHAR(64),
  new_digest VARCHAR(64),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_change_type CHECK (change_type IN ('expired', 'corrected', 'source_updated', 'rights_changed', 'disputed', 'review_accepted', 'review_rejected'))
);

CREATE TABLE IF NOT EXISTS trust_impact_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id UUID NOT NULL REFERENCES trust_change_events(id) ON DELETE CASCADE,
  affected_nodes JSONB NOT NULL DEFAULT '[]'::JSONB,
  processing_order JSONB NOT NULL DEFAULT '[]'::JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_impact_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'human_review'))
);

CREATE TABLE IF NOT EXISTS trust_score_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(20) NOT NULL,
  version VARCHAR(80) NOT NULL,
  ruleset JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_model_subject CHECK (subject_type IN ('tenant', 'landlord', 'property')),
  CONSTRAINT ck_trust_model_status CHECK (status IN ('draft', 'active', 'retired')),
  UNIQUE (subject_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_score_model_active
  ON trust_score_models (subject_type) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS trust_score_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  derived_node_id UUID NOT NULL REFERENCES trust_derived_nodes(id) ON DELETE RESTRICT,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  property_id UUID,
  model_id UUID NOT NULL REFERENCES trust_score_models(id),
  model_version VARCHAR(80) NOT NULL,
  score NUMERIC(6,2) NOT NULL,
  band VARCHAR(20) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  input_digest VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_score_value CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT ck_trust_score_confidence CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT ck_trust_score_status CHECK (status IN ('PUBLISHED', 'SUSPENDED', 'RECOMPUTING', 'SUPERSEDED', 'REVIEW_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS idx_trust_score_latest
  ON trust_score_runs (subject_type, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trust_score_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_run_id UUID NOT NULL REFERENCES trust_score_runs(id) ON DELETE CASCADE,
  fact_id UUID REFERENCES trust_fact_nodes(id) ON DELETE SET NULL,
  feature VARCHAR(100) NOT NULL,
  input_value JSONB,
  weight NUMERIC(8,4) NOT NULL,
  contribution NUMERIC(8,4) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  reason_code VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_transaction_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  landlord_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  realtor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'lease',
  stage VARCHAR(30) NOT NULL DEFAULT 'pre_application',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  requirements JSONB NOT NULL DEFAULT '{}'::JSONB,
  terms JSONB NOT NULL DEFAULT '{}'::JSONB,
  terms_evidence_hash VARCHAR(64),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_transaction_stage CHECK (stage IN ('pre_application', 'application', 'negotiation', 'contract', 'completed', 'cancelled')),
  CONSTRAINT ck_trust_transaction_status CHECK (status IN ('active', 'held', 'completed', 'cancelled', 'disputed'))
);

CREATE TABLE IF NOT EXISTS trust_disclosure_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(80) NOT NULL,
  subject_type VARCHAR(20) NOT NULL,
  recipient_role VARCHAR(20) NOT NULL,
  transaction_stage VARCHAR(30) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  claim_rules JSONB NOT NULL,
  ttl_minutes INTEGER NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version, subject_type, recipient_role, transaction_stage, purpose)
);

CREATE TABLE IF NOT EXISTS trust_disclosure_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  derived_node_id UUID NOT NULL REFERENCES trust_derived_nodes(id) ON DELETE RESTRICT,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES trust_transaction_contexts(id) ON DELETE CASCADE,
  consent_id UUID NOT NULL REFERENCES data_consents(id) ON DELETE RESTRICT,
  policy_id UUID NOT NULL REFERENCES trust_disclosure_policies(id),
  policy_version VARCHAR(80) NOT NULL,
  claims JSONB NOT NULL,
  evidence_digests TEXT[] NOT NULL DEFAULT '{}',
  nonce VARCHAR(64) NOT NULL,
  signature VARCHAR(128) NOT NULL,
  revocation_handle VARCHAR(64) UNIQUE NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_disclosure_state CHECK (state IN ('ISSUED', 'REVOKING', 'REISSUING', 'REVOKED', 'REPLACED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_trust_disclosure_recipient
  ON trust_disclosure_packages (recipient_id, state, expires_at DESC);

CREATE TABLE IF NOT EXISTS trust_tenancy_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID UNIQUE NOT NULL REFERENCES trust_transaction_contexts(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID,
  contract_hash VARCHAR(64) UNIQUE NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  dispute_status VARCHAR(20) NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_relationship_verification CHECK (verification_status IN ('pending', 'verified', 'rejected', 'held')),
  CONSTRAINT ck_trust_relationship_dispute CHECK (dispute_status IN ('none', 'pending', 'accepted', 'rejected', 'resolved'))
);

CREATE TABLE IF NOT EXISTS trust_reference_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES trust_tenancy_relationships(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responder_role VARCHAR(20) NOT NULL,
  structured_answers JSONB NOT NULL,
  rating NUMERIC(6,2) NOT NULL,
  comment_digest VARCHAR(64),
  shared_identifier_hash VARCHAR(64),
  reveal_state VARCHAR(20) NOT NULL DEFAULT 'SEALED',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reveal_after TIMESTAMPTZ NOT NULL,
  revealed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'valid',
  CONSTRAINT ck_trust_reference_role CHECK (responder_role IN ('tenant', 'landlord')),
  CONSTRAINT ck_trust_reference_reveal CHECK (reveal_state IN ('SEALED', 'PUBLISHED', 'HELD', 'REVOKED')),
  CONSTRAINT ck_trust_reference_rating CHECK (rating BETWEEN 0 AND 100),
  UNIQUE (relationship_id, responder_id)
);

CREATE TABLE IF NOT EXISTS trust_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES trust_tenancy_relationships(id) ON DELETE CASCADE,
  reference_submission_id UUID UNIQUE NOT NULL REFERENCES trust_reference_submissions(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trust_value NUMERIC(6,2) NOT NULL,
  base_weight NUMERIC(6,4) NOT NULL DEFAULT 1,
  current_weight NUMERIC(6,4) NOT NULL DEFAULT 1,
  risk_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_graph_state CHECK (state IN ('ACTIVE', 'QUARANTINED', 'DISPUTED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT ck_trust_graph_risk CHECK (risk_score BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS trust_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id UUID REFERENCES trust_graph_edges(id) ON DELETE CASCADE,
  relationship_id UUID REFERENCES trust_tenancy_relationships(id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL,
  signal_value NUMERIC(8,4) NOT NULL,
  threshold NUMERIC(8,4) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_type VARCHAR(30) NOT NULL,
  reason TEXT NOT NULL,
  proposed_value JSONB,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  original_snapshot JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  decision VARCHAR(30),
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_review_status CHECK (status IN ('pending', 'reviewing', 'accepted', 'partially_accepted', 'rejected', 'completed'))
);

CREATE TABLE IF NOT EXISTS trust_match_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES trust_transaction_contexts(id) ON DELETE CASCADE,
  model_version VARCHAR(80) NOT NULL,
  mismatch_vector JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  evidence_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_condition_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_run_id UUID NOT NULL REFERENCES trust_match_runs(id) ON DELETE CASCADE,
  derived_node_id UUID NOT NULL REFERENCES trust_derived_nodes(id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL REFERENCES trust_transaction_contexts(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(40) NOT NULL,
  value JSONB NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE',
  disclaimer_version VARCHAR(40) NOT NULL DEFAULT 'trust-advisory-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_recommendation_status CHECK (status IN ('VISIBLE', 'HIDDEN', 'SUPERSEDED', 'ACCEPTED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS trust_contract_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID UNIQUE NOT NULL REFERENCES trust_transaction_contexts(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  outcome VARCHAR(30) NOT NULL,
  contract_hash VARCHAR(64) NOT NULL,
  terms_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_contract_outcome CHECK (outcome IN ('completed', 'cancelled', 'defaulted', 'disputed', 'renewed'))
);

CREATE TABLE IF NOT EXISTS trust_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  request_id VARCHAR(100),
  trace_id VARCHAR(100),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_outbox_pending
  ON trust_outbox_events (available_at, created_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS trust_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  purpose VARCHAR(80) NOT NULL,
  result VARCHAR(30) NOT NULL,
  fields TEXT[] NOT NULL DEFAULT '{}',
  request_id VARCHAR(100),
  trace_id VARCHAR(100),
  ip_hash VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_audit_target
  ON trust_audit_events (target_type, target_id, occurred_at DESC);

INSERT INTO trust_source_registry (code, name, source_type, reliability, allowed_fields, automation_level)
VALUES
  ('user_direct', '사용자 직접 입력', 'direct_input', 0.4500, '{}', 'manual'),
  ('user_upload', '사용자 제출 서류', 'upload', 0.6000, '{}', 'assisted'),
  ('human_review', '관리자 검수', 'manual_review', 0.9000, '{}', 'manual'),
  ('legacy_profile', '기존 프로필·검증값', 'direct_input', 0.5000, '{}', 'manual')
ON CONFLICT (code) DO NOTHING;

INSERT INTO trust_score_models (subject_type, version, ruleset, status, effective_from)
VALUES
  ('tenant', 'tenant-trust-1.0', '{"rules":[{"field":"identity_verified","weight":15,"reason":"IDENTITY_CONFIRMED"},{"field":"employment_verified","weight":20,"reason":"EMPLOYMENT_CONFIRMED"},{"field":"income_requirement_met","weight":20,"reason":"INCOME_CONFIRMED"},{"field":"credit_verified","weight":10,"reason":"CREDIT_CONFIRMED"},{"field":"relationship_verified","weight":20,"reason":"RELATIONSHIP_VERIFIED"},{"field":"payment_reliable","weight":15,"reason":"PAYMENT_RELIABLE"}]}'::JSONB, 'active', NOW()),
  ('landlord', 'landlord-trust-1.0', '{"rules":[{"field":"identity_verified","weight":15,"reason":"IDENTITY_CONFIRMED"},{"field":"owner_matched","weight":25,"reason":"OWNER_MATCHED"},{"field":"deposit_returned","weight":20,"reason":"DEPOSIT_RETURN_CONFIRMED"},{"field":"property_management_reliable","weight":20,"reason":"MANAGEMENT_RELIABLE"},{"field":"relationship_verified","weight":20,"reason":"RELATIONSHIP_VERIFIED"}]}'::JSONB, 'active', NOW()),
  ('property', 'property-safety-1.0', '{"rules":[{"field":"owner_matched","weight":20,"reason":"OWNER_MATCHED"},{"field":"registry_clear","weight":25,"reason":"REGISTRY_CLEAR"},{"field":"building_compliant","weight":15,"reason":"BUILDING_COMPLIANT"},{"field":"price_consistent","weight":15,"reason":"PRICE_CONSISTENT"},{"field":"senior_claim_safe","weight":15,"reason":"SENIOR_CLAIM_SAFE"},{"field":"insurance_eligible","weight":10,"reason":"INSURANCE_ELIGIBLE"}]}'::JSONB, 'active', NOW())
ON CONFLICT (subject_type, version) DO NOTHING;

INSERT INTO trust_disclosure_policies
  (version, subject_type, recipient_role, transaction_stage, purpose, claim_rules, ttl_minutes)
VALUES
  ('minimum-claims-1.0', 'tenant', 'landlord', 'pre_application', 'tenant_profile_view', '{"claims":[{"fact":"identity_verified","claim":"identity_verified","representation":"boolean"},{"fact":"employment_verified","claim":"employment_verified","representation":"boolean"},{"fact":"monthly_income","claim":"income_requirement_met","representation":"threshold","condition":"min_monthly_income"}]}'::JSONB, 60),
  ('minimum-claims-1.0', 'tenant', 'landlord', 'application', 'tenant_profile_view', '{"claims":[{"fact":"identity_verified","claim":"identity_verified","representation":"boolean"},{"fact":"employment_verified","claim":"employment_verified","representation":"boolean"},{"fact":"monthly_income","claim":"income_requirement_met","representation":"threshold","condition":"min_monthly_income"},{"fact":"verified_lease_count","claim":"has_verified_lease","representation":"positive"}]}'::JSONB, 180),
  ('minimum-claims-1.0', 'landlord', 'tenant', 'application', 'landlord_profile_view', '{"claims":[{"fact":"identity_verified","claim":"identity_verified","representation":"boolean"},{"fact":"owner_matched","claim":"owner_matched","representation":"boolean"},{"fact":"deposit_returned","claim":"deposit_return_history_confirmed","representation":"boolean"}]}'::JSONB, 180),
  ('minimum-claims-1.0', 'property', 'tenant', 'application', 'property_view', '{"claims":[{"fact":"owner_matched","claim":"owner_matched","representation":"boolean"},{"fact":"registry_clear","claim":"registry_clear","representation":"boolean"},{"fact":"senior_claim_safe","claim":"senior_claim_safe","representation":"boolean"},{"fact":"insurance_eligible","claim":"insurance_eligible","representation":"boolean"}]}'::JSONB, 180)
ON CONFLICT (version, subject_type, recipient_role, transaction_stage, purpose) DO NOTHING;

