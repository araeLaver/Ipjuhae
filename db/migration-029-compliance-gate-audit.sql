-- Migration 029: immutable audit history for compliance gate decisions.

CREATE TABLE IF NOT EXISTS trust_compliance_gate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_key TEXT NOT NULL REFERENCES trust_compliance_gates(gate_key) ON DELETE RESTRICT,
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_compliance_gate_events_key
  ON trust_compliance_gate_events(gate_key, changed_at DESC);

CREATE OR REPLACE FUNCTION reject_trust_compliance_gate_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'trust_compliance_gate_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reject_trust_compliance_gate_event_mutation
  ON trust_compliance_gate_events;
DROP TRIGGER IF EXISTS reject_trust_compliance_gate_event_row_mutation
  ON trust_compliance_gate_events;
CREATE TRIGGER reject_trust_compliance_gate_event_row_mutation
  BEFORE UPDATE OR DELETE ON trust_compliance_gate_events
  FOR EACH ROW
  EXECUTE FUNCTION reject_trust_compliance_gate_event_mutation();

DROP TRIGGER IF EXISTS reject_trust_compliance_gate_event_truncate
  ON trust_compliance_gate_events;
CREATE TRIGGER reject_trust_compliance_gate_event_truncate
  BEFORE TRUNCATE ON trust_compliance_gate_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION reject_trust_compliance_gate_event_mutation();

CREATE OR REPLACE FUNCTION audit_trust_compliance_gate_update()
RETURNS TRIGGER AS $$
DECLARE
  actor_id_text TEXT;
  actor_id UUID;
BEGIN
  actor_id_text := current_setting('app.compliance_actor_id', TRUE);
  IF actor_id_text IS NULL OR BTRIM(actor_id_text) = '' THEN
    RAISE EXCEPTION 'app.compliance_actor_id is required to update compliance gates';
  END IF;
  actor_id := actor_id_text::UUID;
  IF NOT EXISTS (
    SELECT 1
      FROM users
     WHERE id = actor_id
       AND user_type = 'admin'
  ) THEN
    RAISE EXCEPTION 'compliance gate actor must be an administrator';
  END IF;

  INSERT INTO trust_compliance_gate_events
    (gate_key, previous_state, new_state, changed_by)
  VALUES
    (NEW.gate_key, TO_JSONB(OLD), TO_JSONB(NEW), actor_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_trust_compliance_gate_update
  ON trust_compliance_gates;
CREATE TRIGGER audit_trust_compliance_gate_update
  AFTER UPDATE ON trust_compliance_gates
  FOR EACH ROW
  EXECUTE FUNCTION audit_trust_compliance_gate_update();
