-- 커뮤니티 신고
--
-- 가입 없이 누구나 쓰는 익명 게시판이라 신고 수단이 반드시 있어야 한다.
-- Apple 심사지침 1.2와 Play의 사용자 제작 콘텐츠 정책이 요구하는 조건이고,
-- 실제로도 문제 글이 올라왔을 때 대응할 방법이 이것뿐이다.
--
-- 신고가 쌓이면 운영자가 볼 때까지 기다리지 않고 먼저 가린다.
-- 잘못 가려진 글은 운영자가 되돌릴 수 있지만, 그동안 노출되는 피해는 되돌릴 수 없다.

CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  -- 신고자. 로그인 사용자는 user id, 익명은 IP 해시.
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_hash TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- 같은 사람이 같은 글을 여러 번 신고해 숫자를 부풀리지 못하게 한다.
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_post_reporter_idx
  ON community_reports (post_id, COALESCE(reporter_id::text, reporter_hash))
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_reports_comment_reporter_idx
  ON community_reports (comment_id, COALESCE(reporter_id::text, reporter_hash))
  WHERE comment_id IS NOT NULL;

-- 가려진 글. 삭제(deleted_at)와 구분한다 — 운영자가 되돌릴 수 있어야 한다.
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS community_posts_visible_idx
  ON community_posts (created_at DESC)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;
