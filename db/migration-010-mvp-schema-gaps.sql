-- Migration 010b: MVP schema gaps from legacy top-level migrations
--
-- migrate.ts only executes db/schema.sql and db/migration-*.sql. Some MVP tables
-- previously lived only under /migrations, so a fresh database could fail before
-- booting current APIs. Keep this migration idempotent and non-destructive.

-- Legacy source: /migrations/0004_listings.sql + /migrations/0006_listings_pet_status.sql
-- Must run before migration-011-reviews.sql, which references listings(id).
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monthly_rent INTEGER NOT NULL,
  deposit INTEGER NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  area_sqm NUMERIC(6, 2),
  floor INTEGER,
  photo_urls TEXT[] DEFAULT '{}',
  available_from DATE DEFAULT CURRENT_DATE,
  pet_allowed BOOLEAN DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'rented', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_landlord ON listings(landlord_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- Current verification APIs persist identity fields on profiles. They can create
-- an identity-only profile before onboarding fills lifestyle fields.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_ci TEXT,
  ADD COLUMN IF NOT EXISTS identity_di TEXT;

ALTER TABLE profiles
  ALTER COLUMN age_range DROP NOT NULL,
  ALTER COLUMN family_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_identity_verified
  ON profiles(identity_verified)
  WHERE identity_verified = TRUE;

-- Legacy source: /migrations/migration-010-premium.sql
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS landlord_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_landlord_id
  ON landlord_subscriptions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_active
  ON landlord_subscriptions(landlord_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_payment_ref
  ON landlord_subscriptions(payment_ref)
  WHERE payment_ref IS NOT NULL;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_properties_featured
  ON properties(is_featured DESC, boost_score DESC, created_at DESC)
  WHERE status = 'available';

CREATE OR REPLACE FUNCTION expire_featured_properties()
RETURNS void AS $$
BEGIN
  UPDATE properties
  SET is_featured = FALSE, featured_until = NULL
  WHERE is_featured = TRUE
    AND featured_until IS NOT NULL
    AND featured_until < NOW();
END;
$$ LANGUAGE plpgsql;
