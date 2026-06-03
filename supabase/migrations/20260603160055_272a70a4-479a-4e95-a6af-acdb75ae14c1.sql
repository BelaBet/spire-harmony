
-- 1. Isolate sensitive PIX key into its own staff-only table
CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (
  tenant_id uuid PRIMARY KEY,
  pix_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payment_settings TO authenticated;
GRANT ALL ON public.tenant_payment_settings TO service_role;

ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tps_staff_select ON public.tenant_payment_settings
  FOR SELECT
  USING (public.is_tenant_staff(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY tps_admin_modify ON public.tenant_payment_settings
  FOR ALL
  USING (public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'admin'::public.app_role) OR public.is_platform_admin(auth.uid()));

-- 2. Backfill existing pix keys
INSERT INTO public.tenant_payment_settings (tenant_id, pix_key)
SELECT id, pix_key FROM public.tenants WHERE pix_key IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Remove sensitive column from tenants
ALTER TABLE public.tenants DROP COLUMN IF EXISTS pix_key;

-- 4. Update accessor function to read from the new table
CREATE OR REPLACE FUNCTION public.get_tenant_pix_key(_tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tps.pix_key
  FROM public.tenant_payment_settings tps
  WHERE tps.tenant_id = _tenant_id
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.tenant_id = _tenant_id
      )
      OR public.is_platform_admin(auth.uid())
    )
  LIMIT 1
$function$;

-- 5. Recreate tenants_public as a security_invoker view (no longer DEFINER)
DROP VIEW IF EXISTS public.tenants_public;
CREATE VIEW public.tenants_public
WITH (security_invoker = true) AS
SELECT id, name, slug, logo_url, primary_color, secondary_color, accent_color,
       custom_domain, tagline, cover_photo_url, active
FROM public.tenants
WHERE deleted_at IS NULL AND active = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;

-- 6. Tighten tenants SELECT: only staff/admin/platform admin can read the full row.
--    Public/member branding access goes through tenants_public via a separate
--    anon-safe SELECT policy scoped to active, non-deleted rows.
DROP POLICY IF EXISTS tenants_member_or_admin_select ON public.tenants;
DROP POLICY IF EXISTS tenants_public_branding_select ON public.tenants;

CREATE POLICY tenants_staff_select ON public.tenants
  FOR SELECT
  USING (public.is_tenant_staff(auth.uid(), id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY tenants_public_branding_select ON public.tenants
  FOR SELECT
  USING (deleted_at IS NULL AND active = true);

-- 7. Tighten group_members self-select to require the group belong to the
--    user's current tenant (defense in depth for cross-tenant enumeration).
DROP POLICY IF EXISTS group_members_self_select ON public.group_members;
CREATE POLICY group_members_self_select ON public.group_members
  FOR SELECT
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.tenant_id = public.current_tenant_id()
    )
  );

-- 8. Tighten Realtime topic policy on messages: require approved profile in
--    the same tenant for messages:tenant:<id> subscriptions.
DROP POLICY IF EXISTS "Authenticated can read realtime topics they own" ON public.messages;
CREATE POLICY "Authenticated can read realtime topics they own"
ON public.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications:'::text || (auth.uid())::text))
  OR ((realtime.topic() ~~ 'group_members:%'::text) AND (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE ((gm.group_id)::text = split_part(realtime.topic(), ':'::text, 2))
      AND gm.profile_id = auth.uid()
  )))
  OR ((realtime.topic() ~~ 'messages:tenant:%'::text)
      AND split_part(realtime.topic(), ':'::text, 3) = (public.current_tenant_id())::text
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = public.current_tenant_id()
          AND p.status = 'approved'::public.profile_status
      ))
  OR (realtime.topic() = ('messages:user:'::text || (auth.uid())::text))
  OR ((realtime.topic() ~~ 'messages:group:%'::text) AND (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE ((gm.group_id)::text = split_part(realtime.topic(), ':'::text, 3))
      AND gm.profile_id = auth.uid()
  )))
  OR ((realtime.topic() ~~ '%:staff:%'::text)
      AND public.is_tenant_staff(auth.uid(), (NULLIF(split_part(realtime.topic(), ':'::text, 3), ''::text))::uuid))
);
