-- Atomic increment function for cases_created counter
-- Prevents race conditions and ensures counter only moves AFTER successful insert

CREATE OR REPLACE FUNCTION public.increment_cases_created(
  _user_id uuid,
  _ym text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  -- Upsert row if missing, then increment atomically
  INSERT INTO usage_counters_monthly (user_id, ym, cases_created, credits_spent, ai_sessions_started)
  VALUES (_user_id, _ym, 1, 0, 0)
  ON CONFLICT (user_id, ym)
  DO UPDATE SET cases_created = usage_counters_monthly.cases_created + 1
  RETURNING cases_created INTO new_count;
  
  RETURN new_count;
END;
$$;

-- Grant execute to authenticated users (edge functions use service_role which bypasses this)
GRANT EXECUTE ON FUNCTION public.increment_cases_created(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_cases_created(uuid, text) TO service_role;