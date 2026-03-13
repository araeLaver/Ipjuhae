-- Migration 011: Tenant Profile MVP
-- 임차인 프로필 테이블 (예산, 선호지역, 입주일, 반려동물, 직장)

CREATE TABLE IF NOT EXISTS tenant_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- 예산 (만원 단위)
  budget_min          INTEGER NOT NULL DEFAULT 0,
  budget_max          INTEGER NOT NULL DEFAULT 0,

  -- 선호 지역 (서울 구 목록)
  preferred_districts TEXT[] NOT NULL DEFAULT '{}',

  -- 입주 희망일
  move_in_date        DATE NOT NULL,

  -- 반려동물 여부
  has_pets            BOOLEAN NOT NULL DEFAULT FALSE,

  -- 직장 (회사명 또는 직장 위치)
  workplace           VARCHAR(100),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_profiles_user_id ON tenant_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_move_in_date ON tenant_profiles(move_in_date);
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_budget ON tenant_profiles(budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_districts ON tenant_profiles USING GIN(preferred_districts);

CREATE TRIGGER update_tenant_profiles_updated_at
  BEFORE UPDATE ON tenant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
