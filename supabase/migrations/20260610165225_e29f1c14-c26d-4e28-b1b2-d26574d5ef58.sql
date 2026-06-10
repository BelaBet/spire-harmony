
-- 1. Deterministic current_tenant_id (profiles.id is PK, but add ORDER BY for defense-in-depth)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.profiles
  WHERE id = auth.uid()
  ORDER BY tenant_id
  LIMIT 1
$$;

-- 2. Tighten realtime staff topic pattern: require explicit "tenant:staff:<uuid>" prefix
DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON realtime.messages;

CREATE POLICY "Authenticated can read realtime topics they own"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications:'::text || (auth.uid())::text))
  OR (
    (realtime.topic() ~~ 'group_members:%'::text)
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id::text = split_part(realtime.topic(), ':', 2)
        AND gm.profile_id = auth.uid()
        AND g.tenant_id = public.current_tenant_id()
    )
  )
  OR (
    (realtime.topic() ~~ 'messages:tenant:%'::text)
    AND split_part(realtime.topic(), ':', 3) = (public.current_tenant_id())::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = public.current_tenant_id()
        AND p.status = 'approved'::public.profile_status
    )
  )
  OR (realtime.topic() = ('messages:user:'::text || (auth.uid())::text))
  OR (
    (realtime.topic() ~~ 'messages:group:%'::text)
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id::text = split_part(realtime.topic(), ':', 3)
        AND gm.profile_id = auth.uid()
        AND g.tenant_id = public.current_tenant_id()
    )
  )
  OR (
    -- Tightened: require explicit "tenant:staff:<uuid>" prefix instead of "%:staff:%"
    (realtime.topic() ~~ 'tenant:staff:%'::text)
    AND public.is_tenant_staff(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 3), '')::uuid
    )
  )
);

-- 3. Harden user_roles admin policy: explicitly require admin on the ROW's tenant_id
--    (current_tenant_id check kept as additional guard against cross-tenant writes)
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

CREATE POLICY user_roles_admin_all
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role)
  )
);
