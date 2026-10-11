CREATE TABLE IF NOT EXISTS policy_news_state (
  id integer PRIMARY KEY CHECK (id = 1),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  failed_windows integer NOT NULL DEFAULT 0,
  last_error text,
  api_day date,
  api_calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO policy_news_state (id) VALUES (1) ON CONFLICT DO NOTHING;
