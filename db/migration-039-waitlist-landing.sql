-- 사전 대기열 랜딩페이지: 중개사 역할 허용 + 전화번호 필수/이메일 선택 전환 + 이름/동의 기록
ALTER TABLE waitlist DROP CONSTRAINT IF EXISTS waitlist_user_type_check;
ALTER TABLE waitlist ADD CONSTRAINT waitlist_user_type_check
  CHECK (user_type IN ('tenant', 'landlord', 'agent'));

-- 전화번호가 1차 연락 수단, 이메일은 선택
ALTER TABLE waitlist ALTER COLUMN email DROP NOT NULL;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS consent_version TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_phone_key ON waitlist (phone) WHERE phone IS NOT NULL;
