-- Plan Overrides Table (admin can manually set plan for any user)
CREATE TABLE IF NOT EXISTS public.plan_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'unlimited')),
  is_active boolean NOT NULL DEFAULT true,
  reason text NULL,
  created_by uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Plan Override Audit Table (log of all changes)
CREATE TABLE IF NOT EXISTS public.plan_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_plan text NULL,
  new_plan text NULL,
  old_is_active boolean NULL,
  new_is_active boolean NULL,
  reason text NULL,
  actor_user_id uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_override_audit ENABLE ROW LEVEL SECURITY;

-- Create is_admin function (checks for specific admin email)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'imbimbo.bassman@gmail.com'
$$;

-- RLS Policies for plan_overrides (admin only)
CREATE POLICY "Admin can view all plan overrides"
ON public.plan_overrides
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin can insert plan overrides"
ON public.plan_overrides
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update plan overrides"
ON public.plan_overrides
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin can delete plan overrides"
ON public.plan_overrides
FOR DELETE
TO authenticated
USING (public.is_admin());

-- RLS Policies for plan_override_audit (admin only)
CREATE POLICY "Admin can view audit logs"
ON public.plan_override_audit
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin can insert audit logs"
ON public.plan_override_audit
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Add triggers for updated_at
CREATE TRIGGER update_plan_overrides_updated_at
BEFORE UPDATE ON public.plan_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_overrides_user_id ON public.plan_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_overrides_active ON public.plan_overrides(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plan_override_audit_target ON public.plan_override_audit(target_user_id);