-- Migration 030: migrate trust transaction stages to S*-coded state machine, add outcome/event metadata, and align outcome enums.

ALTER TABLE trust_transaction_contexts
  ALTER COLUMN stage SET DEFAULT 'S0';

UPDATE trust_transaction_contexts
   SET stage = CASE stage
      WHEN 'pre_application' THEN 'S0'
      WHEN 'application' THEN 'S1'
      WHEN 'negotiation' THEN 'S2'
      WHEN 'contract' THEN 'S3'
      WHEN 'completed' THEN 'S8'
      WHEN 'cancelled' THEN 'S0'
      ELSE stage
    END;

ALTER TABLE trust_transaction_contexts
  DROP CONSTRAINT IF EXISTS ck_trust_transaction_stage;
ALTER TABLE trust_transaction_contexts
  ADD CONSTRAINT ck_trust_transaction_stage
    CHECK (stage IN ('S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'));

ALTER TABLE trust_transaction_contexts
  ADD COLUMN IF NOT EXISTS evaluation_flags JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS dispute_meta JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE trust_contract_outcomes
  DROP CONSTRAINT IF EXISTS ck_trust_contract_outcome;
ALTER TABLE trust_contract_outcomes
  ADD CONSTRAINT ck_trust_contract_outcome
    CHECK (outcome IN ('ContractSigned', 'MoveInConfirmed', 'LeaseEnded', 'DepositReturned', 'completed', 'cancelled', 'defaulted', 'disputed', 'renewed'));

UPDATE trust_contract_outcomes
   SET outcome = CASE
      WHEN outcome = 'completed' THEN 'completed'
      WHEN outcome = 'cancelled' THEN 'cancelled'
      WHEN outcome = 'defaulted' THEN 'defaulted'
      WHEN outcome = 'disputed' THEN 'disputed'
      WHEN outcome = 'renewed' THEN 'renewed'
      ELSE 'disputed'
    END;