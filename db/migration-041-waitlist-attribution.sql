-- 사전 신청자 유입 경로 기록
-- 어느 채널(스레드/인스타/쇼츠/오프라인)에서 온 신청인지 알아야
-- 콘텐츠 투자를 어디에 몰아줄지 판단할 수 있다.
--
-- 개인정보를 늘리지 않는 것이 원칙이라 다음은 저장하지 않는다:
--   - IP 주소, User-Agent 원문
--   - referrer 전체 URL (쿼리스트링에 개인정보가 실려 올 수 있음) → 호스트만 저장
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referrer_host TEXT;

CREATE INDEX IF NOT EXISTS waitlist_utm_source_idx
  ON waitlist (utm_source) WHERE utm_source IS NOT NULL;
