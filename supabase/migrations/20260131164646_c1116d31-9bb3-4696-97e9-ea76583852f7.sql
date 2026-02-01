-- Add is_family column to profiles if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_family') THEN 
    ALTER TABLE public.profiles ADD COLUMN is_family boolean DEFAULT false;
  END IF;
END $$;

-- Add plan_override column to profiles if not exists (for simple override tracking)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan_override') THEN 
    ALTER TABLE public.profiles ADD COLUMN plan_override text DEFAULT NULL;
  END IF;
END $$;

-- Add index for quick lookup of protected users
CREATE INDEX IF NOT EXISTS idx_profiles_family_override ON public.profiles (is_family, plan_override) WHERE is_family = true OR plan_override IS NOT NULL;