-- Migration 016: Ensure analytics_events table exists
--
-- Root cause: analytics_events was only defined in /migrations/0005_analytics_events.sql
-- (the older top-level migrations folder). The db/migrations/ folder — which is what
-- migrate.ts runs in production — never had this table, so the relation was missing.

CREATE TABLE IF NOT EXISTS analytics_events (
  id         BIGSERIAL PRIMARY KEY,
  event_name TEXT      NOT NULL,
  properties JSONB     DEFAULT '{}',
  user_id    UUID      REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name    ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id) WHERE user_id IS NOT NULL;
