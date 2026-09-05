-- 신청자·방문자 기능 요구사항 소통창구
CREATE TABLE IF NOT EXISTS feature_requests (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  contact TEXT,
  user_type TEXT CHECK (user_type IN ('tenant', 'landlord', 'agent')),
  source TEXT NOT NULL DEFAULT 'preview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_requests_created_at_idx
  ON feature_requests (created_at DESC);
