-- 매물 테이블
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- 기본 정보
  title VARCHAR(100) NOT NULL,
  description TEXT,

  -- 주소
  address VARCHAR(200) NOT NULL,
  address_detail VARCHAR(100),
  region VARCHAR(50),  -- 시/구 (예: 서울시 강남구)

  -- 가격
  deposit BIGINT NOT NULL,  -- 보증금 (원)
  monthly_rent BIGINT NOT NULL,  -- 월세 (원)
  maintenance_fee BIGINT DEFAULT 0,  -- 관리비 (원)

  -- 매물 정보
  property_type VARCHAR(20) NOT NULL,  -- 'apartment', 'villa', 'officetel', 'oneroom', 'house', 'other'
  room_count INT DEFAULT 1,  -- 방 개수
  bathroom_count INT DEFAULT 1,  -- 화장실 개수
  floor INT,  -- 층수
  total_floor INT,  -- 총 층수
  area_sqm DECIMAL(10, 2),  -- 면적 (제곱미터)

  -- 옵션
  options TEXT[],  -- 옵션 목록 (에어컨, 세탁기, 냉장고 등)

  -- 상태
  status VARCHAR(20) DEFAULT 'available',  -- 'available', 'reserved', 'rented', 'hidden'
  available_from DATE,  -- 입주 가능일

  -- 메타
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 매물 이미지 테이블
CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region);
CREATE INDEX IF NOT EXISTS idx_properties_deposit ON properties(deposit);
CREATE INDEX IF NOT EXISTS idx_properties_monthly_rent ON properties(monthly_rent);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_sort_order ON property_images(property_id, sort_order);

-- 코멘트
COMMENT ON TABLE properties IS '집주인 매물 정보';
COMMENT ON TABLE property_images IS '매물 이미지';
COMMENT ON COLUMN properties.deposit IS '보증금 (원 단위)';
COMMENT ON COLUMN properties.monthly_rent IS '월세 (원 단위)';
COMMENT ON COLUMN properties.property_type IS '매물 유형: apartment(아파트), villa(빌라), officetel(오피스텔), oneroom(원룸), house(주택), other(기타)';
COMMENT ON COLUMN properties.status IS '상태: available(공실), reserved(예약중), rented(계약완료), hidden(비공개)';
