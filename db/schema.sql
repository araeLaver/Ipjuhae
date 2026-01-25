-- 입주해 (Ipjuhae) 데이터베이스 스키마
-- PostgreSQL

-- 기존 테이블 삭제 (개발용)
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
  bio TEXT,                         -- 자유 한마디 (100자)

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
