-- Migration 025: Account deletion support on fresh databases

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users(deleted_at)
  WHERE deleted_at IS NOT NULL;
