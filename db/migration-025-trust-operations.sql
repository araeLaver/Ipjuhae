-- Migration 025: operational workflow for extraction, revocation, retention and delivery audit

ALTER TABLE trust_source_registry
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_latency_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS privacy_risk NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  ADD CONSTRAINT ck_trust_source_privacy_risk CHECK (privacy_risk BETWEEN 0 AND 1);

CREATE TABLE IF NOT EXISTS trust_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  property_id UUID,
  source_id UUID NOT NULL REFERENCES trust_source_registry(id),
  consent_id UUID REFERENCES data_consents(id) ON DELETE SET NULL,
  storage_ref TEXT NOT NULL,
  input_checksum VARCHAR(64) NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  engine_version VARCHAR(80) NOT NULL DEFAULT 'manual-review-1.0',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(80),
  error_detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_extraction_subject CHECK (subject_type IN ('tenant', 'landlord', 'property')),
  CONSTRAINT ck_trust_extraction_status CHECK (status IN ('pending', 'scanning', 'extracting', 'review_required', 'completed', 'failed', 'cancelled')),
  UNIQUE (owner_user_id, input_checksum, document_type)
);

CREATE INDEX IF NOT EXISTS idx_trust_extraction_queue
  ON trust_extraction_jobs (status, created_at) WHERE status IN ('pending', 'scanning', 'extracting', 'review_required');

CREATE TABLE IF NOT EXISTS trust_extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_job_id UUID NOT NULL REFERENCES trust_extraction_jobs(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  raw_value JSONB,
  normalized_value JSONB NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  page_ref VARCHAR(40),
  bounding_box JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'candidate',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_extracted_confidence CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT ck_trust_extracted_status CHECK (status IN ('candidate', 'accepted', 'rejected', 'corrected')),
  UNIQUE (extraction_job_id, field_name)
);

CREATE TABLE IF NOT EXISTS trust_retention_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(40) NOT NULL,
  target_id UUID NOT NULL,
  policy_code VARCHAR(80) NOT NULL,
  action VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  result JSONB,
  exception_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_retention_action CHECK (action IN ('delete', 'anonymize', 'restrict', 'legal_hold', 'storage_delete')),
  CONSTRAINT ck_trust_retention_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'excepted')),
  UNIQUE (target_type, target_id, policy_code, action)
);

CREATE TABLE IF NOT EXISTS trust_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES trust_outbox_events(id) ON DELETE SET NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id UUID NOT NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel VARCHAR(30) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'pending',
  external_receipt VARCHAR(200),
  delivered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_delivery_state CHECK (state IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged'))
);

CREATE TABLE IF NOT EXISTS trust_external_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES trust_source_registry(id),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  subject_type VARCHAR(20) NOT NULL,
  subject_id UUID NOT NULL,
  purpose VARCHAR(80) NOT NULL,
  consent_id UUID REFERENCES data_consents(id) ON DELETE SET NULL,
  requested_fields TEXT[] NOT NULL DEFAULT '{}',
  request_digest VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  response_digest VARCHAR(64),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_external_status CHECK (status IN ('pending', 'authorized', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE OR REPLACE FUNCTION revoke_trust_disclosures_on_consent_change()
RETURNS TRIGGER AS $$
DECLARE
  package_record RECORD;
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'revoked' THEN
    FOR package_record IN
      SELECT id, derived_node_id, transaction_id
        FROM trust_disclosure_packages
       WHERE consent_id = NEW.id AND state = 'ISSUED'
    LOOP
      UPDATE trust_disclosure_packages
         SET state = 'REVOKED', revoked_at = NOW(), revoke_reason = 'consent_withdrawn'
       WHERE id = package_record.id;
      UPDATE trust_derived_nodes SET state = 'REVOKED' WHERE id = package_record.derived_node_id;
      INSERT INTO trust_outbox_events (aggregate_type, aggregate_id, event_type, payload)
      VALUES ('disclosure', package_record.id, 'DisclosureRevoked', jsonb_build_object(
        'reason', 'consent_withdrawn',
        'consent_id', NEW.id,
        'transaction_id', package_record.transaction_id
      ));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS revoke_trust_disclosures_on_consent_change ON data_consents;
CREATE TRIGGER revoke_trust_disclosures_on_consent_change
  AFTER UPDATE OF status ON data_consents
  FOR EACH ROW
  EXECUTE FUNCTION revoke_trust_disclosures_on_consent_change();

