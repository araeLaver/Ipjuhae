-- Migration 026: close the A1 evidence -> fact -> derived dependency chain.

INSERT INTO trust_dependency_edges
  (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type)
SELECT 'evidence', evidence_id, 'fact', id, 'required'
  FROM trust_fact_nodes
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION link_trust_evidence_to_fact()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trust_dependency_edges
    (from_node_type, from_node_id, to_node_type, to_node_id, dependency_type)
  VALUES ('evidence', NEW.evidence_id, 'fact', NEW.id, 'required')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS link_trust_evidence_to_fact ON trust_fact_nodes;
CREATE TRIGGER link_trust_evidence_to_fact
  AFTER INSERT ON trust_fact_nodes
  FOR EACH ROW
  EXECUTE FUNCTION link_trust_evidence_to_fact();

CREATE OR REPLACE FUNCTION stale_trust_facts_on_evidence_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state = 'VALID' AND NEW.state IN ('EXPIRED', 'CONFLICT', 'CORRECTED', 'REPLACED', 'DELETED', 'HELD') THEN
    UPDATE trust_fact_nodes
       SET status = CASE WHEN NEW.state = 'HELD' THEN 'HELD' ELSE 'STALE' END,
           updated_at = NOW()
     WHERE evidence_id = NEW.id
       AND status IN ('ACTIVE', 'CONFIRMED', 'REVISED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stale_trust_facts_on_evidence_change ON trust_evidence_nodes;
CREATE TRIGGER stale_trust_facts_on_evidence_change
  AFTER UPDATE OF state ON trust_evidence_nodes
  FOR EACH ROW
  EXECUTE FUNCTION stale_trust_facts_on_evidence_change();

