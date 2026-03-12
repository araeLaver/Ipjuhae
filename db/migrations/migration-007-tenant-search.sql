-- Migration 007: Tenant Search Enhancement (P0)
-- Add preferred_regions column and search indexes

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_regions TEXT[] DEFAULT '{}';

-- Partial indexes for common filter columns (only complete profiles)
CREATE INDEX IF NOT EXISTS idx_profiles_family_type ON profiles(family_type) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_smoking ON profiles(smoking) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_duration ON profiles(duration) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_noise_level ON profiles(noise_level) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score DESC) WHERE is_complete = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC) WHERE is_complete = TRUE;

-- GIN index for array overlap queries
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_regions ON profiles USING GIN(preferred_regions);
CREATE INDEX IF NOT EXISTS idx_profiles_pets ON profiles USING GIN(pets);
