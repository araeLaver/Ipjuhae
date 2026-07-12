-- Migration 023: API idempotency cache + reference token abuse control + response uniqueness

CREATE TABLE IF NOT EXISTS api_idempotency_requests (
  namespace VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_id VARCHAR(64),
  trace_id VARCHAR(64),
  request_hash VARCHAR(128),
  in_progress BOOLEAN NOT NULL DEFAULT TRUE,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (namespace, idempotency_key),
  CONSTRAINT ck_api_idempotency_status CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_requests_expires
  ON api_idempotency_requests (expires_at);

CREATE OR REPLACE FUNCTION update_api_idempotency_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_api_idempotency_requests_updated_at ON api_idempotency_requests;
CREATE TRIGGER update_api_idempotency_requests_updated_at
  BEFORE UPDATE ON api_idempotency_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_api_idempotency_requests_updated_at();

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS token_access_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_last_accessed_ip VARCHAR(45),
  ADD COLUMN IF NOT EXISTS token_blocked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_verification_metadata JSONB DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_landlord_references_token_blocked
  ON landlord_references (token_blocked_until, status)
  WHERE token_blocked_until IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reference_responses_reference_id
  ON reference_responses (reference_id);
