-- 얼리액세스 신청 테이블 (이슈 #72)
CREATE TABLE IF NOT EXISTS early_access (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS early_access_created_at_idx ON early_access (created_at DESC);
CREATE INDEX IF NOT EXISTS early_access_city_idx ON early_access (city);
