-- migration-012: landlord_references, reference_responses tables
-- + trust score columns for cron expire-references

-- landlord_references 테이블
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

CREATE INDEX IF NOT EXISTS idx_references_user_id ON landlord_references(user_id);
CREATE INDEX IF NOT EXISTS idx_references_token ON landlord_references(verification_token);
CREATE INDEX IF NOT EXISTS idx_references_status ON landlord_references(status);
CREATE INDEX IF NOT EXISTS idx_references_expires ON landlord_references(token_expires_at) WHERE status = 'sent';

-- reference_responses 테이블
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

-- profiles 테이블에 trust score 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reference_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_score INT DEFAULT 0;
