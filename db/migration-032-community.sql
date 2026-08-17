-- Migration 032: role-segmented community (임차인/임대인/공인중개사/전체)
-- Boards are scoped by audience; a user reads the shared 'all' board plus the
-- board for their own role, and may post to 'all' or their own role's board.

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience VARCHAR(20) NOT NULL DEFAULT 'all',
  category VARCHAR(40),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_community_audience CHECK (audience IN ('all', 'tenant', 'landlord', 'broker'))
);

CREATE INDEX IF NOT EXISTS idx_community_posts_audience
  ON community_posts (audience, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_author
  ON community_posts (author_id);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments (post_id, created_at) WHERE deleted_at IS NULL;
