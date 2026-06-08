
-- 1. Notifications: ensure staff can only insert for users in their tenant
DROP POLICY IF EXISTS notifications_staff_insert ON public.notifications;
CREATE POLICY notifications_staff_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    is_tenant_staff(auth.uid(), tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = notifications.profile_id
        AND p.tenant_id = notifications.tenant_id
    )
  );

-- 2. Payments: add WITH CHECK to prevent staff from re-tenanting or changing ownership
DROP POLICY IF EXISTS payments_staff_update ON public.payments;
CREATE POLICY payments_staff_update ON public.payments
  FOR UPDATE TO authenticated
  USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- 3. Subscription plans: restrict full row read to platform admins;
--    expose a safe public view without business-sensitive fee fields.
DROP POLICY IF EXISTS plans_select_all ON public.subscription_plans;
CREATE POLICY plans_select_admin ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE OR REPLACE VIEW public.subscription_plans_public
WITH (security_invoker = true) AS
SELECT id, code, name, monthly_price, sort_order, active
FROM public.subscription_plans
WHERE active;

GRANT SELECT ON public.subscription_plans_public TO authenticated, anon;
