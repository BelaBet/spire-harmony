DROP POLICY IF EXISTS tps_staff_select ON public.tenant_payment_settings;
CREATE POLICY tps_admin_select ON public.tenant_payment_settings
FOR SELECT USING (
  public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  OR public.is_platform_admin(auth.uid())
);