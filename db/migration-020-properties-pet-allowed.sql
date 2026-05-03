-- Migration 020: Add pet_allowed to properties + consolidate listings data
--
-- Root cause: The properties table was missing pet_allowed, so tenant pet
-- matching (in /api/matches) was forced to query the legacy listings table.
-- This migration makes properties the single canonical source for listings.

-- 1. Add pet_allowed column to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pet_allowed BOOLEAN DEFAULT NULL;

-- 2. Migrate listing rows into properties (idempotent, skips duplicates)
INSERT INTO properties (
  id, landlord_id, title, address, deposit, monthly_rent,
  area_sqm, floor, status, available_from, pet_allowed, created_at, updated_at
)
SELECT
  gen_random_uuid(), l.landlord_id, COALESCE(l.address, '제목 없음'),
  l.address, l.deposit, l.monthly_rent, l.area_sqm, l.floor,
  COALESCE(l.status, 'available'), COALESCE(l.available_from, CURRENT_DATE),
  l.pet_allowed, l.created_at, l.updated_at
FROM listings l
WHERE NOT EXISTS (
  SELECT 1 FROM properties p
  WHERE p.landlord_id = l.landlord_id
    AND p.address = l.address
    AND p.monthly_rent = l.monthly_rent
);

-- 3. Migrate photo_urls from listings into property_images (idempotent)
INSERT INTO property_images (id, property_id, image_url, thumbnail_url, sort_order, is_main)
SELECT
  gen_random_uuid(), p.id, url, url,
  (ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY url)) - 1,
  ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY url) = 1
FROM listings l
JOIN properties p
  ON p.landlord_id = l.landlord_id
  AND p.address = l.address
  AND p.monthly_rent = l.monthly_rent
CROSS JOIN LATERAL unnest(l.photo_urls) AS url
WHERE array_length(l.photo_urls, 1) > 0
  AND NOT EXISTS (SELECT 1 FROM property_images pi WHERE pi.property_id = p.id)
ON CONFLICT DO NOTHING;
