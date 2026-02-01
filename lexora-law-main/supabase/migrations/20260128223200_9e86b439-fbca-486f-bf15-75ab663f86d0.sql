-- Remove the overly permissive "Service role can manage subscriptions" policy
-- Service role already bypasses RLS automatically when using SUPABASE_SERVICE_ROLE_KEY
-- This policy was incorrectly allowing all authenticated users to read ALL subscription records

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;

-- The existing "Users can view their own subscription" policy remains and correctly restricts access:
-- USING (auth.uid() = user_id)