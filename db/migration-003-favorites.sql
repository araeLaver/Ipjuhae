-- 세입자 즐겨찾기 테이블
-- 집주인이 관심있는 세입자 프로필을 저장

CREATE TABLE IF NOT EXISTS tenant_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  note VARCHAR(200),  -- 집주인 메모 (선택)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 중복 방지
  UNIQUE(landlord_id, tenant_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_favorites_landlord_id ON tenant_favorites(landlord_id);
CREATE INDEX IF NOT EXISTS idx_favorites_tenant_id ON tenant_favorites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON tenant_favorites(created_at DESC);

-- 코멘트
COMMENT ON TABLE tenant_favorites IS '집주인의 세입자 즐겨찾기';
COMMENT ON COLUMN tenant_favorites.note IS '집주인이 남기는 개인 메모';
