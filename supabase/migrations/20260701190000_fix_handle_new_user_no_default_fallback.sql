-- CORREÇÃO: remove o fallback silencioso para um tenant de slug 'default'
-- em handle_new_user(). Esse fallback fazia com que qualquer cadastro sem
-- um tenant_id válido no metadata do auth.users fosse silenciosamente
-- vinculado a qualquer tenant existente com slug 'default' (hoje a TK2),
-- misturando novas instituições/sellers com um seller já existente.
--
-- Confirmado que os dois fluxos atuais de criação de usuário
-- (src/routes/signup.tsx e src/lib/tenant-signup.functions.ts) sempre
-- passam tenant_id explicitamente no metadata. Portanto o fallback nunca
-- é necessário em uso normal — se ele disparar, é sinal de bug em algum
-- fluxo de cadastro, e deve falhar alto (RAISE EXCEPTION) em vez de
-- silenciosamente juntar o novo usuário a outra instituição.
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

  IF _meta_tenant_id IS NULL OR _meta_tenant_id = '' THEN
    RAISE EXCEPTION 'Cadastro sem tenant_id no metadata (user %). Fluxo de signup deve sempre informar a instituição de destino.', NEW.id;
  END IF;

  BEGIN
    _tenant_id := _meta_tenant_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'tenant_id inválido no metadata (user %): %', NEW.id, _meta_tenant_id;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'tenant_id % não corresponde a nenhuma instituição ativa (user %).', _tenant_id, NEW.id;
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
