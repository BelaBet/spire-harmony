
-- 1) Restrict access to tenants.pix_key for anonymous users via column-level grants.
-- Public (anon) can still resolve a tenant by custom_domain/subdomain/slug for the
-- landing page, but cannot read pix_key. Authenticated users keep full access
-- (subject to existing UPDATE policies).
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (
  id, name, slug, logo_url, primary_color, secondary_color, accent_color,
  custom_domain, active, tagline, cover_photo_url, created_at, deleted_at,
  deleted_by
) ON public.tenants TO anon;
GRANT SELECT ON public.tenants TO authenticated;

-- 2) Restrict group_members SELECT for regular tenant members to their own rows.
-- Staff retain full access via the existing group_members_staff_all policy.
DROP POLICY IF EXISTS group_members_tenant_select ON public.group_members;
CREATE POLICY group_members_self_select
ON public.group_members
FOR SELECT
USING (profile_id = auth.uid());

-- 3) Add INSERT/UPDATE/DELETE policies for the private 'receipts' storage bucket,
-- scoped to the owner's user-id folder, matching the existing SELECT policy.
CREATE POLICY "Users can upload their own receipts"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own receipts"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
