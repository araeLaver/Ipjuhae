-- 베타 초대 시스템

-- waitlist 테이블에 초대 관련 컬럼 추가
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS signed_up_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_waitlist_invite_token ON waitlist (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_invited ON waitlist (invited_at) WHERE invited_at IS NOT NULL;

-- early_access 테이블에도 동일 적용
ALTER TABLE early_access ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) UNIQUE;
ALTER TABLE early_access ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE early_access ADD COLUMN IF NOT EXISTS signed_up_at TIMESTAMPTZ;

-- 베타 설정 테이블
CREATE TABLE IF NOT EXISTS beta_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본값: 베타 모드 활성화
INSERT INTO beta_config (key, value) VALUES ('beta_enabled', 'true') ON CONFLICT DO NOTHING;
INSERT INTO beta_config (key, value) VALUES ('max_invites', '100') ON CONFLICT DO NOTHING;
