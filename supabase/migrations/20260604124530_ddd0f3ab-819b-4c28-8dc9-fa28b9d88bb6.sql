
-- Fix 1: tenants_public view - use security_invoker so RLS of caller applies
ALTER VIEW public.tenants_public SET (security_invoker = true);

-- Allow public/anon to read only safe columns of tenants for tenant discovery
DROP POLICY IF EXISTS tenants_public_discovery ON public.tenants;
CREATE POLICY tenants_public_discovery ON public.tenants
  FOR SELECT TO anon, authenticated
  USING (active = true AND deleted_at IS NULL);

-- Restrict column access on tenants for anon to only non-sensitive ones
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (id, name, slug, logo_url, primary_color, secondary_color, accent_color, custom_domain, tagline, cover_photo_url, active)
  ON public.tenants TO anon;
GRANT SELECT ON public.tenants_public TO anon, authenticated;

-- Fix 2: notifications - add tenant scoping
DROP POLICY IF EXISTS notifications_self_select ON public.notifications;
CREATE POLICY notifications_self_select ON public.notifications
  FOR SELECT
  USING (profile_id = auth.uid() AND tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS notifications_self_update ON public.notifications;
CREATE POLICY notifications_self_update ON public.notifications
  FOR UPDATE
  USING (profile_id = auth.uid() AND tenant_id = public.current_tenant_id())
  WITH CHECK (profile_id = auth.uid() AND tenant_id = public.current_tenant_id());

-- Fix 3: platform_settings - restrict to authenticated users
DROP POLICY IF EXISTS settings_select_all ON public.platform_settings;
CREATE POLICY settings_select_authenticated ON public.platform_settings
  FOR SELECT TO authenticated
  USING (true);
