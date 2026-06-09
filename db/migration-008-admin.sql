-- Migration 008: Admin user type + verification documents
-- 2026-03-12

-- 1. users.user_type에 'admin' 추가 (기존 'tenant' | 'landlord' → 'tenant' | 'landlord' | 'admin')
-- PostgreSQL은 ALTER TYPE ... ADD VALUE 또는 CHECK 제약 변경 필요
-- 현재 VARCHAR(20)이므로 체크 제약만 추가
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('tenant', 'landlord', 'admin'));

-- 2. verification_documents 테이블 (서류 심사)
-- 기존 테이블에 관리자 심사 컬럼 추가
ALTER TABLE verification_documents
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 기존 제약 조건 및 인덱스 보강
ALTER TABLE verification_documents DROP CONSTRAINT IF EXISTS verification_documents_status_check;
ALTER TABLE verification_documents ADD CONSTRAINT verification_documents_status_check
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected'));

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
