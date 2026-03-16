-- 리뷰/평점 테이블
-- 거래 완료 후 임대인↔세입자 간 5점 별점 + 한줄평

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 동일 거래 중복 방지
  UNIQUE(reviewer_id, reviewee_id, listing_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- 코멘트
COMMENT ON TABLE reviews IS '거래 완료 후 임대인↔세입자 평점';
COMMENT ON COLUMN reviews.rating IS '1-5점 별점';
COMMENT ON COLUMN reviews.comment IS '최대 200자 한줄평';
