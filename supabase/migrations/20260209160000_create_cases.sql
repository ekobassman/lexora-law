-- Create cases table for Lexora
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'cases'
    ) THEN
        CREATE TABLE public.cases (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          title text NOT NULL DEFAULT 'Nuova pratica',
          status text NOT NULL DEFAULT 'new',
          source text NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- Enable RLS on cases table
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can insert own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can update own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON public.cases;

-- Create RLS policies for cases
CREATE POLICY "Users can view own cases" ON public.cases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cases" ON public.cases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cases" ON public.cases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cases" ON public.cases
  FOR DELETE USING (auth.uid() = user_id);

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.cases;

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at_trigger
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create index on user_id and created_at for performance
CREATE INDEX IF NOT EXISTS idx_cases_user_id_created_at ON public.cases(user_id, created_at DESC);

-- Grant permissions
GRANT ALL ON public.cases TO authenticated;
GRANT SELECT ON public.cases TO anon;
