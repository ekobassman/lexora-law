-- RPC per health check: verifica esistenza oggetti critici via to_regclass
-- Usata dalla Edge Function "health"

CREATE OR REPLACE FUNCTION public.schema_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cases', to_regclass('public.cases') IS NOT NULL,
    'pratiche', to_regclass('public.pratiche') IS NOT NULL,
    'documents', to_regclass('public.documents') IS NOT NULL,
    'user_roles', to_regclass('public.user_roles') IS NOT NULL,
    'plan_limits', to_regclass('public.plan_limits') IS NOT NULL,
    'user_plan', to_regclass('public.user_plan') IS NOT NULL,
    'usage_counters_monthly', to_regclass('public.usage_counters_monthly') IS NOT NULL,
    'legal_versions', to_regclass('public.legal_versions') IS NOT NULL,
    'user_legal_acceptances', to_regclass('public.user_legal_acceptances') IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.schema_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.schema_health() TO anon;

COMMENT ON FUNCTION public.schema_health() IS 'Health check: returns jsonb of table existence (to_regclass)';
