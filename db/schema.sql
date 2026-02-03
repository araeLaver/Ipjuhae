-- 입주해 (Ipjuhae) 데이터베이스 스키마
-- PostgreSQL

-- ⚠️ 주의: 아래 DROP 문은 개발 환경 초기화 전용입니다.
-- 프로덕션에서는 마이그레이션 도구(Prisma, Drizzle 등)를 사용하세요.
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로필 테이블
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  age_range VARCHAR(20) NOT NULL,  -- '20대초반', '20대후반', '30대', '40대이상'
  family_type VARCHAR(20) NOT NULL, -- '1인', '커플', '가족'
  pets TEXT[] DEFAULT '{}',         -- ['없음'], ['강아지'], ['고양이'], ['기타']
  smoking BOOLEAN DEFAULT FALSE,

  -- 라이프스타일
  stay_time VARCHAR(20),            -- '아침', '저녁', '주말만', '거의없음'
  duration VARCHAR(20),             -- '6개월', '1년', '2년', '장기'
  noise_level VARCHAR(20),          -- '조용', '보통', '활발'
  bio VARCHAR(200),                  -- 자유 한마디 (100자 권장, 최대 200자)

  -- 자기소개서 (사용자 직접 작성)
  intro TEXT,

  -- 신뢰 점수
  trust_score INT DEFAULT 20,

  -- 상태
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_is_complete ON profiles(is_complete);
CREATE INDEX idx_users_email ON users(email);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 추가 테이블 (신뢰점수, 인증, 레퍼런스, 집주인)
-- =====================================================

-- 1. users 테이블 확장 (user_type 컬럼)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'tenant';

-- 2. verifications 테이블 (인증 정보)
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  employment_verified BOOLEAN DEFAULT FALSE,
  employment_company VARCHAR(100),
  employment_verified_at TIMESTAMPTZ,
  income_verified BOOLEAN DEFAULT FALSE,
  income_range VARCHAR(50),
  income_verified_at TIMESTAMPTZ,
  credit_verified BOOLEAN DEFAULT FALSE,
  credit_grade INT CHECK (credit_grade BETWEEN 1 AND 3),
  credit_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. landlord_references 테이블 (집주인 레퍼런스)
CREATE TABLE IF NOT EXISTS landlord_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  landlord_name VARCHAR(100),
  landlord_phone VARCHAR(20) NOT NULL,
  landlord_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  verification_token VARCHAR(128) UNIQUE,
  token_expires_at TIMESTAMPTZ,
  request_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. reference_responses 테이블 (설문 응답)
CREATE TABLE IF NOT EXISTS reference_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID REFERENCES landlord_references(id) ON DELETE CASCADE,
  rent_payment INT CHECK (rent_payment BETWEEN 1 AND 5),
  property_condition INT CHECK (property_condition BETWEEN 1 AND 5),
  neighbor_issues INT CHECK (neighbor_issues BETWEEN 1 AND 5),
  checkout_condition INT CHECK (checkout_condition BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  comment VARCHAR(500),
  overall_rating VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. landlord_profiles 테이블
CREATE TABLE IF NOT EXISTS landlord_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  property_count INT DEFAULT 0,
  property_regions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. profile_views 테이블 (열람 기록)
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(landlord_id, profile_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_references_user_id ON landlord_references(user_id);
CREATE INDEX IF NOT EXISTS idx_references_token ON landlord_references(verification_token);
CREATE INDEX IF NOT EXISTS idx_landlord_profiles_user_id ON landlord_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_landlord_id ON profile_views(landlord_id);

-- 추가 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_age_range ON profiles(age_range) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_references_status ON landlord_references(status);
CREATE INDEX IF NOT EXISTS idx_references_expires ON landlord_references(token_expires_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_reference_responses_ref_id ON reference_responses(reference_id);

-- verifications 테이블 트리거
CREATE TRIGGER update_verifications_updated_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- landlord_profiles 테이블 트리거
CREATE TRIGGER update_landlord_profiles_updated_at
  BEFORE UPDATE ON landlord_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
