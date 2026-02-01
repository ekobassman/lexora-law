-- Add sender data fields to pratiche table for per-letter customization
-- These fields allow users to override profile data for individual letters

ALTER TABLE public.pratiche
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_address TEXT,
ADD COLUMN IF NOT EXISTS sender_postal_code TEXT,
ADD COLUMN IF NOT EXISTS sender_city TEXT,
ADD COLUMN IF NOT EXISTS sender_country TEXT,
ADD COLUMN IF NOT EXISTS sender_date DATE;