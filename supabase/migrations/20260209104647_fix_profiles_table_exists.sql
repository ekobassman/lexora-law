-- Fix: Handle existing profiles table
-- This migration checks if profiles table exists and creates it only if it doesn't

DO $$
BEGIN
    -- Check if profiles table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        -- Create profiles table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name TEXT,
            address TEXT,
            city TEXT,
            postal_code TEXT,
            country TEXT DEFAULT 'DE',
            preferred_language TEXT DEFAULT 'IT',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
    END IF;
END $$;