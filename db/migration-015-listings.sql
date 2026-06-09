CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monthly_rent INTEGER NOT NULL,
  deposit INTEGER NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  area_sqm NUMERIC(6,2),
  floor INTEGER,
  photo_urls TEXT[] DEFAULT '{}',
  available_from DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_landlord ON listings(landlord_id);
