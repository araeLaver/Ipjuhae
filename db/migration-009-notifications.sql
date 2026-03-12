-- Migration 009: Notifications System
-- 인앱 알림 센터: 새 메시지, 레퍼런스 요청/완료, 인증 상태 변경, 환영 알림

-- 알림 타입 ENUM
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'new_message',
    'reference_request',
    'reference_completed',
    'verification_approved',
    'verification_rejected',
    'trust_score_updated',
    'welcome',
    'admin_notice'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  link            VARCHAR(500),        -- 클릭 시 이동할 URL
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',  -- type별 추가 데이터 (sender_id, conversation_id 등)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 30일 이상 읽은 알림 자동 정리 함수 (pg_cron 미사용 시 수동 호출)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE is_read = TRUE AND read_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 미읽은 알림 수 함수 (캐시 없이 직접 카운트)
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER FROM notifications
    WHERE user_id = p_user_id AND is_read = FALSE
  );
END;
$$ LANGUAGE plpgsql;

-- READ ME:
-- 기존 메시지/레퍼런스 이벤트에서 notifications INSERT 트리거는
-- 애플리케이션 레이어에서 처리 (lib/notifications.ts)
