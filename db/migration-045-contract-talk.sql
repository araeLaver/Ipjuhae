-- 계약 전 대화 요청 전용 신규 테이블. 기존 데이터/권한은 변경하지 않는다.
-- 기존 ipjuhae search_path 및 users 인증 모델을 사용한다.
CREATE TABLE contract_talk_requests (
  id UUID PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE CHECK (share_id ~ '^[a-f0-9]{64}$'),
  recipient_hash TEXT NOT NULL CHECK (recipient_hash ~ '^[a-f0-9]{64}$'),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_key UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, client_key),
  CHECK (payload->>'id' = id::text),
  CHECK (payload->>'ownerId' = owner_id::text),
  CHECK (payload->>'shareId' = share_id),
  CHECK (payload->>'recipientHash' = recipient_hash),
  CHECK ((payload->>'version')::integer = version)
);
CREATE INDEX contract_talk_expiry_idx ON contract_talk_requests(expires_at);
-- 본문/계정 식별자는 URL에 넣지 않는다. share_id는 만료되는 초대 식별자이며
-- 로그인·역할·참여자 검사 없이는 수정/응답 권한이 생기지 않는다.
-- 만료 30일 후 전용 cron/생성 시 정리. 요청자 삭제 시 cascade, 응답자 탈퇴는 기존 인증에서 차단.

CREATE INDEX contract_talk_owner_created_idx ON contract_talk_requests(owner_id, created_at);
