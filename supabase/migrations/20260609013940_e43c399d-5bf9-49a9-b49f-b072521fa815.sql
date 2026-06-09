
-- audit_logs: enforce tenant_id = current_tenant_id() on insert
DROP POLICY IF EXISTS audit_staff_insert ON public.audit_logs;
CREATE POLICY audit_staff_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_staff(auth.uid(), tenant_id)
      OR public.is_platform_admin(auth.uid())
    )
  );

-- messages: enforce tenant_id = current_tenant_id() on insert
DROP POLICY IF EXISTS messages_staff_insert ON public.messages;
CREATE POLICY messages_staff_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_staff(auth.uid(), tenant_id)
  );

-- user_roles: prevent admins from inserting roles into other tenants
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    (
      tenant_id = public.current_tenant_id()
      AND public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    )
    OR public.is_platform_admin(auth.uid())
  );

-- Drop stray duplicate realtime SELECT policy mistakenly attached to public.messages.
-- The correct policy lives on realtime.messages and already enforces tenant scope.
DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON public.messages;
