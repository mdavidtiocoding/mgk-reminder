-- Fix push subscribe RLS (run once in Supabase SQL Editor if push activation failed)

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (public.is_active_user() AND user_id = auth.uid())
  WITH CHECK (public.is_active_user() AND user_id = auth.uid());
