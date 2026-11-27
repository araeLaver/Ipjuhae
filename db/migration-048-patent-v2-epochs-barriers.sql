-- Migration 048: Patent V2 Core Engine (PD-261178TP1 Claims 1-8)
-- Adds monotonic invalidation_epoch / access_epoch counters, versioned reverse & input
-- dependency indexes, per-package content-key encryption fields, revocation barrier
-- tracking, and atomic contract pinning vectors. Fully additive & idempotent.

-- 1. Claim 1(a) & 6: Fact node version + monotonic invalidation_epoch
ALTER TABLE trust_fact_nodes
  ADD COLUMN IF NOT EXISTS node_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS invalidation_epoch BIGINT NOT NULL DEFAULT 0;

-- 2. Claim 1(b) & 1(h): Derived node evidence_version_vector + code_version
ALTER TABLE trust_derived_nodes
  ADD COLUMN IF NOT EXISTS evidence_version_vector JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS code_version VARCHAR(80);

-- 3. Claim 1(b) & Claim 4: Versioned dependency edges + B-tree reverse-adjacency & input indexes
ALTER TABLE trust_dependency_edges
  ADD COLUMN IF NOT EXISTS from_node_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS to_node_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_trust_dep_reverse_versioned
  ON trust_dependency_edges (from_node_type, from_node_id, from_node_version);

CREATE INDEX IF NOT EXISTS idx_trust_dep_input_versioned
  ON trust_dependency_edges (to_node_type, to_node_id, to_node_version);

-- 4. Claim 1(c), 1(g), 2 & 3: Per-package content key status, encrypted payload, access_epoch & disclosure_cost
ALTER TABLE trust_disclosure_packages
  ADD COLUMN IF NOT EXISTS access_epoch BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_key_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS encrypted_payload TEXT,
  ADD COLUMN IF NOT EXISTS payload_iv VARCHAR(64),
  ADD COLUMN IF NOT EXISTS payload_auth_tag VARCHAR(64),
  ADD COLUMN IF NOT EXISTS wrapped_content_key TEXT,
  ADD COLUMN IF NOT EXISTS disclosure_cost INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_trust_disclosure_key_status'
  ) THEN
    ALTER TABLE trust_disclosure_packages
      ADD CONSTRAINT ck_trust_disclosure_key_status
      CHECK (content_key_status IN ('ACTIVE', 'DESTROYED', 'ROTATED'));
  END IF;
END $$;

-- 5. Claim 1(g) & Claim 7: Explicit revocation barrier ensuring revocation completes prior to recomputation
CREATE TABLE IF NOT EXISTS trust_revocation_barriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id UUID NOT NULL REFERENCES trust_change_events(id) ON DELETE CASCADE,
  expected_count INTEGER NOT NULL DEFAULT 0,
  revoked_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_trust_revocation_barrier_status CHECK (status IN ('PENDING', 'COMPLETED')),
  CONSTRAINT ck_trust_revocation_barrier_counts CHECK (expected_count >= 0 AND revoked_count >= 0 AND revoked_count <= expected_count),
  UNIQUE (change_event_id)
);

-- 6. Claim 1(d) & 1(i): Transaction contract-pending pinned hashes & epoch vectors
ALTER TABLE trust_transaction_contexts
  ADD COLUMN IF NOT EXISTS condition_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pinned_evidence_vector JSONB,
  ADD COLUMN IF NOT EXISTS pinned_evidence_set_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pinned_epoch_vector JSONB,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- 7. Claim 1(g) & Claim 5: Work deduplication key, expected node version & priority queue field
ALTER TABLE trust_impact_jobs
  ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(128),
  ADD COLUMN IF NOT EXISTS expected_node_version INTEGER,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 10;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trust_impact_jobs_dedup_key
  ON trust_impact_jobs (dedup_key)
  WHERE dedup_key IS NOT NULL;
