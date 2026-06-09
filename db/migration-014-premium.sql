-- Migration 010: Premium features
-- 집주인 프리미엄 구독 + 피처드 매물

-- 프리미엄 구독 플랜 타입
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 프리미엄 구독 테이블
CREATE TABLE IF NOT EXISTS landlord_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan          subscription_plan NOT NULL DEFAULT 'free',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  payment_ref   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_landlord_id
  ON landlord_subscriptions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_expires_at
  ON landlord_subscriptions(expires_at) WHERE is_active = true;

-- properties 테이블에 featured 컬럼 추가
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_featured    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_score    INTEGER NOT NULL DEFAULT 0;

-- featured 매물 인덱스 (상단 노출 정렬용)
CREATE INDEX IF NOT EXISTS idx_properties_featured
  ON properties(is_featured DESC, boost_score DESC, created_at DESC)
  WHERE status = 'available';

-- 프리미엄 플랜별 한도 설정
-- free:  매물 3개, featured 0개
-- basic: 매물 10개, featured 2개
-- pro:   매물 무제한, featured 5개

-- 피처드 만료 자동 해제 함수
CREATE OR REPLACE FUNCTION expire_featured_properties()
RETURNS void AS $$
BEGIN
  UPDATE properties
  SET is_featured = false, featured_until = NULL
  WHERE is_featured = true
    AND featured_until IS NOT NULL
    AND featured_until < NOW();
END;
$$ LANGUAGE plpgsql;
