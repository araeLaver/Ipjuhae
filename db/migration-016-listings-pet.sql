-- Migration 006: Add pet_allowed and status to listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS pet_allowed BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'rented', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
