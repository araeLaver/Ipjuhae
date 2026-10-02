-- Server-created upload ownership. Never backfill ownership from user-controlled URLs.
CREATE TABLE account_storage_objects (
  object_key TEXT PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  storage_scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX account_storage_objects_owner_idx ON account_storage_objects(owner_user_id);
ALTER TABLE account_storage_deletes
  ADD COLUMN owner_user_id UUID REFERENCES users(id),
  ADD COLUMN storage_scope TEXT,
  ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retry','review')),
  ADD COLUMN last_error_code TEXT;
-- Legacy queues have no trustworthy ownership proof: quarantine, never destroy.
UPDATE account_storage_deletes SET status='review',last_error_code='OWNERSHIP_UNVERIFIED'
  WHERE owner_user_id IS NULL OR storage_scope IS NULL;
CREATE INDEX account_storage_deletes_due_idx ON account_storage_deletes(next_attempt_at,attempts,created_at)
  WHERE status IN ('pending','retry');
