-- Migration 008: Admin user type + verification documents
-- 2026-03-12

-- 1. users.user_type에 'admin' 추가 (기존 'tenant' | 'landlord' → 'tenant' | 'landlord' | 'admin')
-- PostgreSQL은 ALTER TYPE ... ADD VALUE 또는 CHECK 제약 변경 필요
-- 현재 VARCHAR(20)이므로 체크 제약만 추가
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('tenant', 'landlord', 'admin'));

-- 2. verification_documents 테이블 (서류 심사)
CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('employment', 'income', 'credit')),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
  reject_reason VARCHAR(500),
  reviewed_by UUID REFERENCES users(id),   -- admin user_id
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vdocs_user_id ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_vdocs_status ON verification_documents(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_vdocs_type ON verification_documents(document_type);

CREATE TRIGGER update_vdocs_updated_at
  BEFORE UPDATE ON verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. admin_logs 테이블 (어드민 액션 로그)
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,   -- 'approve_document', 'reject_document', 'adjust_trust_score', 'change_user_type'
  target_type VARCHAR(30) NOT NULL,  -- 'user', 'document', 'profile'
  target_id UUID NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
