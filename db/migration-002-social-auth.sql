-- Migration 002: Social Auth, Phone Verification, Document Upload
-- Run after schema.sql

-- 1. users 테이블 확장
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_agreed_at TIMESTAMPTZ DEFAULT NULL;

-- 소셜 프로바이더 + ID 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users (auth_provider, auth_provider_id)
  WHERE auth_provider IS NOT NULL;

-- 2. 본인인증 번호 저장 테이블
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone
  ON phone_verifications (phone_number, verified, expires_at);

-- 3. 서류 업로드 Mock 테이블
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL, -- 'employment' | 'income' | 'credit'
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'processing' | 'approved' | 'rejected'
  reject_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_user
  ON verification_documents (user_id, document_type);
