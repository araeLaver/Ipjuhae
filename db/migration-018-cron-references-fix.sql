-- Migration 015: Fix cron/references — add missing score columns to profiles
--               and updated_at to landlord_references
--
-- Root cause: /api/cron/references UPDATE query references:
--   profiles.reference_score   (DB error 42703, position 59)
--   profiles.verification_score
--   profiles.profile_score
--   landlord_references.updated_at
-- None of these columns existed in the schema.

-- 1. Add score columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reference_score    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_score      INTEGER NOT NULL DEFAULT 0;

-- 2. Add updated_at to landlord_references (cron does SET updated_at = NOW())
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill updated_at with created_at for existing rows
UPDATE landlord_references
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Make it NOT NULL now that rows are backfilled
ALTER TABLE landlord_references
  ALTER COLUMN updated_at SET NOT NULL;

-- Trigger to keep updated_at current on landlord_references
CREATE TRIGGER update_landlord_references_updated_at
  BEFORE UPDATE ON landlord_references
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
