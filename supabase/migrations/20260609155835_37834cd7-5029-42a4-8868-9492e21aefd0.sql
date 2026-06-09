DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
  )
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (tenant_id = current_tenant_id() AND has_role(auth.uid(), tenant_id, 'admin'::app_role))
  );