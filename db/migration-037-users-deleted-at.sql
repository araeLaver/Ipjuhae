-- 회원탈퇴 소프트 삭제 표시. 계정 삭제 라우트가 기록하고, 인증 경로가
-- deleted_at IS NULL 조건으로 탈퇴 계정의 잔여 토큰 사용을 차단한다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
