-- Migration 021: tenant/landlord consent + access audit + reference edit history
-- Adds data-consent records, consent event history, access audit logs,
-- and reference editability/dispute history needed for patent-described workflow.

CREATE TABLE IF NOT EXISTS data_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role VARCHAR(20) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  allowed_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
  consent_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_data_consents_status CHECK (status IN ('active', 'revoked')),
  CONSTRAINT ck_data_consents_target_role CHECK (target_role IN ('tenant', 'landlord', 'broker', 'admin')),
  CONSTRAINT ck_data_consents_purpose CHECK (
    purpose IN ('tenant_profile_view', 'landlord_profile_view', 'property_view')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_consents_unique_active
  ON data_consents (user_id, target_role, purpose)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_data_consents_user_role_purpose
  ON data_consents (user_id, target_role, purpose, status);

CREATE OR REPLACE FUNCTION update_data_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_data_consents_updated_at ON data_consents;
CREATE TRIGGER update_data_consents_updated_at
  BEFORE UPDATE ON data_consents
  FOR EACH ROW
  EXECUTE FUNCTION update_data_consents_updated_at();

CREATE TABLE IF NOT EXISTS consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_consent_id UUID NOT NULL REFERENCES data_consents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role VARCHAR(20) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  from_payload JSONB,
  to_payload JSONB,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_consent_events_event_type CHECK (event_type IN ('granted', 'updated', 'revoked')),
  CONSTRAINT ck_consent_events_target_role CHECK (target_role IN ('tenant', 'landlord', 'broker', 'admin')),
  CONSTRAINT ck_consent_events_purpose CHECK (
    purpose IN ('tenant_profile_view', 'landlord_profile_view', 'property_view')
  )
);

CREATE INDEX IF NOT EXISTS idx_consent_events_user
  ON consent_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_events_consent
  ON consent_events (data_consent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(20),
  actor_ip VARCHAR(45),
  actor_user_agent TEXT,
  target_type VARCHAR(40) NOT NULL,
  target_id UUID NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  purpose VARCHAR(50) NOT NULL,
  contract_id UUID,
  fields_viewed TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_access_audit_actor_role CHECK (actor_role IN ('tenant', 'landlord', 'broker', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_access_audit_logs_actor
  ON access_audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_logs_target
  ON access_audit_logs (target_type, target_id, created_at DESC);

ALTER TABLE reference_responses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE reference_responses
  ADD COLUMN IF NOT EXISTS editable_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS reference_response_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_response_id UUID NOT NULL REFERENCES reference_responses(id) ON DELETE CASCADE,
  previous_data JSONB NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_fields TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reference_response_history_reference_response
  ON reference_response_history (reference_response_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reference_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_response_id UUID NOT NULL REFERENCES reference_responses(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_reference_disputes_status CHECK (
    status IN ('pending', 'reviewing', 'accepted', 'rejected', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_reference_disputes_response
  ON reference_disputes (reference_response_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reference_disputes_requester
  ON reference_disputes (requester_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_reference_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reference_disputes_updated_at ON reference_disputes;
CREATE TRIGGER update_reference_disputes_updated_at
  BEFORE UPDATE ON reference_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_reference_disputes_updated_at();
