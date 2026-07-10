-- Migration 021: Role-based community spaces

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space VARCHAR(20) NOT NULL CHECK (space IN ('tenant', 'landlord')),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL DEFAULT 'general',
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_space_created
  ON community_posts(space, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_author
  ON community_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_created
  ON community_comments(post_id, created_at ASC);

DO $$ BEGIN
  CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_community_comments_updated_at
    BEFORE UPDATE ON community_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
