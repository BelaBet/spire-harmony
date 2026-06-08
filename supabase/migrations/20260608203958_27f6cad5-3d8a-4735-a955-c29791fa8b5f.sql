DROP POLICY IF EXISTS notifications_staff_insert ON public.notifications;

CREATE POLICY notifications_staff_insert ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.is_tenant_staff(auth.uid(), tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = notifications.profile_id
      AND p.tenant_id = notifications.tenant_id
  )
);