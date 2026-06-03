-- 1) Add document fields to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('cnpj','cpf'));

CREATE UNIQUE INDEX IF NOT EXISTS tenants_document_unique
  ON public.tenants (document)
  WHERE document IS NOT NULL AND deleted_at IS NULL;

-- 2) Update handle_new_user to honor tenant_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _role public.app_role;
  _status public.profile_status;
  _meta_tenant_id text;
BEGIN
  _meta_tenant_id := NEW.raw_user_meta_data->>'tenant_id';

  IF _meta_tenant_id IS NOT NULL AND _meta_tenant_id <> '' THEN
    BEGIN
      _tenant_id := _meta_tenant_id::uuid;
    EXCEPTION WHEN others THEN
      _tenant_id := NULL;
    END;
  END IF;

  -- Fallback: slug-based lookup (legacy) or default
  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id
    FROM public.tenants
    WHERE slug = COALESCE(NEW.raw_user_meta_data->>'tenant_slug', 'default')
    LIMIT 1;
  END IF;

  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = 'default' LIMIT 1;
  END IF;

  -- Role + status: tenant founder vs regular member
  IF (NEW.raw_user_meta_data->>'is_tenant_founder')::boolean IS TRUE THEN
    _role := 'admin'::public.app_role;
    _status := 'approved'::public.profile_status;
  ELSE
    _role := 'member'::public.app_role;
    _status := 'pending'::public.profile_status;
  END IF;

  INSERT INTO public.profiles (id, tenant_id, full_name, email, phone, lgpd_consent, lgpd_consent_at, status)
  VALUES (
    NEW.id,
    _tenant_id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'lgpd_consent')::boolean, false),
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_consent')::boolean THEN now() ELSE NULL END,
    _status
  );

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, _role);

  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();