-- 활성화 시 최초 판정이 armed_at을 생성한다. 재시작으로 grace를 초기화하지 않는다.
CREATE TABLE IF NOT EXISTS ops_deadman_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  armed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_received_at TIMESTAMPTZ,
  last_receive_gap_ms DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'stale')),
  last_evaluated_at TIMESTAMPTZ,
  last_evaluation_gap_ms DOUBLE PRECISION,
  max_evaluation_gap_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  evaluation_count BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ops_deadman_events (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('stale', 'recovered')),
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  message_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'uncertain'))
);
CREATE INDEX IF NOT EXISTS ops_deadman_events_pending ON ops_deadman_events(created_at) WHERE delivery_status = 'pending';
