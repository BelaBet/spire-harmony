
-- 1. Restringir colunas sensíveis em public.tenants no nível de coluna.
--    A RLS já filtra linhas, mas a policy permite SELECT para staff (manager/admin).
--    PostgREST respeita GRANTs por coluna: removendo SELECT das colunas sensíveis
--    para `authenticated` e `anon`, somente o `service_role` (usado em server functions
--    com supabaseAdmin) consegue lê-las.

REVOKE SELECT (
  bank_code,
  bank_agency,
  bank_account,
  bank_account_dv,
  account_type,
  legal_name,
  holder_name,
  holder_document,
  recipient_id,
  recipient_status,
  recipient_error
) ON public.tenants FROM authenticated;

REVOKE SELECT (
  bank_code,
  bank_agency,
  bank_account,
  bank_account_dv,
  account_type,
  legal_name,
  holder_name,
  holder_document,
  recipient_id,
  recipient_status,
  recipient_error
) ON public.tenants FROM anon;

-- service_role mantém ALL (bypassa RLS) — usado por edge/server functions confiáveis.
GRANT ALL ON public.tenants TO service_role;

-- 2. Policy SELECT explícita para tenant_payment_info_cache (só platform admin).
--    service_role já bypassa RLS; isso documenta a única via autorizada via PostgREST.
DROP POLICY IF EXISTS tpic_platform_admin_select ON public.tenant_payment_info_cache;
CREATE POLICY tpic_platform_admin_select
  ON public.tenant_payment_info_cache
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 3. cost_centers: leitura por staff/admin de igreja via view cost_centers_public.
--    A tabela base permanece sem SELECT policy para non-staff por design
--    (split_seller_percent / split_platform_percent são sensíveis).
--    Adicionamos SELECT explícito apenas para platform admin (já coberto por ALL,
--    mas explicitado para clareza do scanner).
DROP POLICY IF EXISTS cost_centers_platform_admin_select ON public.cost_centers;
CREATE POLICY cost_centers_platform_admin_select
  ON public.cost_centers
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
