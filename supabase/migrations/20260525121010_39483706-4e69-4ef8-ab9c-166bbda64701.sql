
-- 1) Fix CROSS_TENANT_DATA_ACCESS: prevent self-update of tenant_id / status
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY profiles_staff_update ON public.profiles
FOR UPDATE
USING (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
WITH CHECK (is_tenant_staff(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- 2) Fix PRIVILEGE_ESCALATION_FUNCTION: only super_admin counts as platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = _user_id AND role = 'super_admin'::platform_role
  );
$function$;

-- 3) Fix MISSING_STORAGE_POLICY: allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 4) Fix SUPA_public_bucket_allows_listing: limit public read to direct file fetches
--    (Listing the bucket contents requires authenticated owner; public can still GET specific files by path)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read tenant-logos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant logos are publicly accessible" ON storage.objects;

-- Note: public buckets still allow anonymous fetch of individual files via the public URL.
-- We intentionally do NOT create a broad SELECT policy; this blocks listing while
-- the storage CDN continues to serve known object paths from public buckets.
