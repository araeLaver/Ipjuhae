-- Durable retry queue: no external object is deleted before database commit.
CREATE TABLE account_storage_deletes (
  object_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
