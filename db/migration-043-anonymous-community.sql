-- 익명 글쓰기
--
-- 가입을 권할 단계가 아닌데 글을 쓰려면 로그인부터 하라고 하면 아무도 안 쓴다.
-- 계정 없이 질문과 댓글을 남길 수 있게 author_id를 선택으로 바꾼다.
-- author_id가 비어 있으면 익명 글이다.
--
-- 지우거나 신고를 처리하려면 작성자를 구분할 수단이 필요한데, 개인정보를
-- 늘리지 않는 선에서 IP를 해시해 저장한다. 원문 IP는 저장하지 않는다.

ALTER TABLE community_posts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE community_comments ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS author_hash TEXT;
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS author_hash TEXT;

CREATE INDEX IF NOT EXISTS community_posts_author_hash_idx
  ON community_posts (author_hash) WHERE author_hash IS NOT NULL;
