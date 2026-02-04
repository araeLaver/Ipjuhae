-- 대화방 테이블
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 집주인-세입자 쌍당 하나의 대화방
  UNIQUE(landlord_id, tenant_id)
);

-- 메시지 테이블
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_conversations_landlord_id ON conversations(landlord_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- 코멘트
COMMENT ON TABLE conversations IS '집주인-세입자 대화방';
COMMENT ON TABLE messages IS '대화 메시지';
