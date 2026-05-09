CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
  _slug TEXT;
BEGIN
  _slug := COALESCE(NEW.raw_user_meta_data->>'tenant_slug', 'default');
  SELECT id INTO _tenant_id FROM public.tenants WHERE slug = _slug LIMIT 1;
  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = 'default' LIMIT 1;
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
    'pending'
  );

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, 'member');

  RETURN NEW;
END;
$function$;