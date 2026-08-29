-- OTP 저장을 평문 6자리에서 HMAC-SHA256 hex(64자)로 전환.
-- 기존 미인증 평문 코드는 해시와 매칭될 수 없으므로 삭제한다(유효기간 3분이라 영향 미미).
DELETE FROM phone_verifications WHERE verified = FALSE;

ALTER TABLE phone_verifications ALTER COLUMN code TYPE VARCHAR(64);

-- 로그아웃된 JWT의 jti 거부 목록. 토큰 만료 시점 이후 cron이 청소한다.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens (expires_at);
