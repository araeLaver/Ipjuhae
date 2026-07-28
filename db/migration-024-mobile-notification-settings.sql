-- Migration 024: Mobile notification settings

CREATE TABLE IF NOT EXISTS mobile_notification_settings (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  message_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  match_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
