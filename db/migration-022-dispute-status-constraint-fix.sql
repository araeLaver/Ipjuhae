-- Migration 022: Expand reference dispute status constraint for platform workflow
--
-- Adds new terminal states used by the reference correction/hold flow:
-- corrected / withheld / deleted.

ALTER TABLE reference_disputes
  DROP CONSTRAINT IF EXISTS ck_reference_disputes_status;

ALTER TABLE reference_disputes
  ADD CONSTRAINT ck_reference_disputes_status
  CHECK (
    status IN (
      'pending',
      'reviewing',
      'accepted',
      'rejected',
      'corrected',
      'withheld',
      'completed',
      'deleted'
    )
  );
