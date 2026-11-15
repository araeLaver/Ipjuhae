-- Account-owned searches; alert delivery is atomic with notifications.
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  q VARCHAR(100) NOT NULL DEFAULT '',
  region VARCHAR(50) NOT NULL DEFAULT '',
  property_type VARCHAR(20) NOT NULL DEFAULT '',
  sort VARCHAR(20) NOT NULL DEFAULT 'created_at',
  alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alerts_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, q, region, property_type, sort),
  CHECK (property_type IN ('', 'apartment', 'villa', 'officetel', 'oneroom', 'house', 'other')),
  CHECK (sort IN ('created_at', 'deposit', 'monthly_rent', 'view_count'))
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts
  ON saved_searches(last_checked_at) WHERE alerts_enabled;

CREATE TABLE IF NOT EXISTS saved_search_deliveries (
  search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (search_id, property_id)
);
