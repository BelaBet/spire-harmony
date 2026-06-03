-- 1) Protect tenants.pix_key from authenticated users (column-level GRANT)
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, active, tagline, cover_photo_url, created_at,
  deleted_at, deleted_by
) ON public.tenants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tenants TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tenant_pix_key(_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.pix_key
  FROM public.tenants t
  WHERE t.id = _tenant_id
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.tenant_id = _tenant_id
      )
      OR public.is_platform_admin(auth.uid())
    )
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_tenant_pix_key(uuid) TO authenticated, anon;

-- 2) Hide draft events from regular members; staff still see all via events_staff_all
DROP POLICY IF EXISTS events_tenant_select ON public.events;
CREATE POLICY events_tenant_select ON public.events
FOR SELECT
USING (tenant_id = public.current_tenant_id() AND status <> 'draft'::event_status);

-- 3) Explicit SELECT policy for the public avatars bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 4) Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime topics they own"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = 'notifications:' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'group_members:%'
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id::text = split_part(realtime.topic(), ':', 2)
        AND gm.profile_id = auth.uid()
    )
  )
  OR (
    realtime.topic() LIKE 'messages:tenant:%'
    AND split_part(realtime.topic(), ':', 3) = public.current_tenant_id()::text
  )
  OR (realtime.topic() = 'messages:user:' || auth.uid()::text)
  OR (
    realtime.topic() LIKE 'messages:group:%'
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id::text = split_part(realtime.topic(), ':', 3)
        AND gm.profile_id = auth.uid()
    )
  )
  OR (
    realtime.topic() LIKE '%:staff:%'
    AND public.is_tenant_staff(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 3), '')::uuid
    )
  )
);
